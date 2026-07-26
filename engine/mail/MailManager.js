import { MimeBuilder } from './MimeBuilder.js';
import { MailMessage } from './MailMessage.js';
import { Mailable } from './Mailable.js';
import { PendingMail } from './PendingMail.js';
import { MailValidator } from './MailValidator.js';
import { ArrayDriver } from './drivers/ArrayDriver.js';
import { LogDriver } from './drivers/LogDriver.js';
import { FileDriver } from './drivers/FileDriver.js';
import { SmtpDriver } from './drivers/SmtpDriver.js';
import { NullDriver } from './drivers/NullDriver.js';
import { FailoverDriver } from './drivers/FailoverDriver.js';

/**
 * Mail manager — Taand's MailManager equivalent with Taand extras.
 */
export class MailManager {
  constructor(app) {
    this.app = app;
    this.#mailers = new Map();
    this.#drivers = new Map();
    this.#default = app.make('config').get('mail.default', 'log');
    this.#rate = { window: Date.now(), count: 0 };
  }

  #mailers;
  #drivers;
  #default;
  #rate;

  mailer(name = null) {
    const resolved = name ?? this.#default;
    if (!this.#mailers.has(resolved)) {
      this.#mailers.set(resolved, this.#createMailer(resolved));
    }
    return this.#mailers.get(resolved);
  }

  to(...addresses) {
    return new PendingMail(this, { to: addresses.flat() });
  }

  async send(mailableOrMessage, mailer = null) {
    return this.to().mailer(mailer).send(mailableOrMessage);
  }

  async sendMessage(message, mailer = null) {
    await this.#checkRateLimit();
    await this.#fire('mail.sending', { message, mailer: mailer ?? this.#default });

    const raw = new MimeBuilder().build(message);
    const driver = this.mailer(mailer);

    try {
      const result = await driver.send(message, raw);
      await this.#fire('mail.sent', { message, result });
      return result;
    } catch (error) {
      await this.#fire('mail.failed', { message, error });
      throw error;
    }
  }

  async resolve(input) {
    if (input instanceof MailMessage) {
      return input.build();
    }

    if (input instanceof Mailable || (input && typeof input.toMessage === 'function')) {
      return input.toMessage();
    }

    if (input && input.to && input.subject) {
      return input;
    }

    throw new Error('[Taand] Invalid mailable or message');
  }

  sent(mailer = 'array') {
    const driver = this.#drivers.get(mailer ?? 'array');
    if (driver?.all) return driver.all();
    return [];
  }

  overview() {
    const mailers = this.app.make('config').get('mail.mailers', {});
    const result = {};

    for (const name of Object.keys(mailers)) {
      const driver = this.#getRawDriver(name);
      result[name] = {
        transport: mailers[name].transport ?? mailers[name].driver,
        sent: driver?.all?.() ?? [],
      };
    }

    return result;
  }

  #createMailer(name) {
    const driver = this.#getRawDriver(name);
    return {
      name,
      async send(message, raw) {
        return driver.send(message, raw);
      },
    };
  }

  #getRawDriver(name) {
    if (this.#drivers.has(name)) return this.#drivers.get(name);

    const mailers = this.app.make('config').get('mail.mailers', {});
    const config = mailers[name];
    if (!config) {
      throw new Error(`[Taand] Mailer [${name}] is not defined`);
    }

    const driver = this.#buildDriver(config, name);
    this.#drivers.set(name, driver);
    return driver;
  }

  #buildDriver(config, name) {
    const transport = config.transport ?? config.driver ?? 'log';

    if (transport === 'null') return new NullDriver();
    if (transport === 'array') return new ArrayDriver();
    if (transport === 'log') return new LogDriver(this.app);
    if (transport === 'file') return new FileDriver(this.app, config);
    if (transport === 'smtp') return new SmtpDriver(config);

    if (transport === 'failover') {
      const drivers = (config.mailers ?? []).map((m) => this.#getRawDriver(m));
      return new FailoverDriver(drivers);
    }

    throw new Error(`[Taand] Unsupported mail transport [${transport}] on mailer [${name}]`);
  }

  async #checkRateLimit() {
    const limit = this.app.make('config').get('mail.rateLimit', 60);
    const now = Date.now();

    if (now - this.#rate.window > 60_000) {
      this.#rate.window = now;
      this.#rate.count = 0;
    }

    this.#rate.count += 1;
    if (this.#rate.count > limit) {
      throw new Error(`[Taand] Mail rate limit exceeded (${limit}/minute)`);
    }
  }

  async #fire(name, payload) {
    if (!this.app.has('events')) return;
    await this.app.make('events').dispatch(name, payload).catch(() => {});
  }
}

// Expose validator for PendingMail
MailManager.validator = MailValidator;
