import { MailMessage } from './MailMessage.js';
import { MailValidator } from './MailValidator.js';

/**
 * Pending mail — fluent to/cc/bcc then send().
 */
export class PendingMail {
  constructor(manager, { to = [], cc = [], bcc = [], mailer = null } = {}) {
    this.#manager = manager;
    this.#to = to;
    this.#cc = cc;
    this.#bcc = bcc;
    this.#mailer = mailer;
  }

  #manager;
  #to;
  #cc;
  #bcc;
  #mailer;

  to(...addresses) {
    return new PendingMail(this.#manager, {
      to: [...this.#to, ...addresses.flat()],
      cc: this.#cc,
      bcc: this.#bcc,
      mailer: this.#mailer,
    });
  }

  cc(...addresses) {
    return new PendingMail(this.#manager, {
      to: this.#to,
      cc: [...this.#cc, ...addresses.flat()],
      bcc: this.#bcc,
      mailer: this.#mailer,
    });
  }

  bcc(...addresses) {
    return new PendingMail(this.#manager, {
      to: this.#to,
      cc: this.#cc,
      bcc: [...this.#bcc, ...addresses.flat()],
      mailer: this.#mailer,
    });
  }

  mailer(name) {
    return new PendingMail(this.#manager, {
      to: this.#to,
      cc: this.#cc,
      bcc: this.#bcc,
      mailer: name,
    });
  }

  async send(mailableOrMessage) {
    let message;

    if (mailableOrMessage instanceof MailMessage) {
      for (const address of this.#to) mailableOrMessage.to(address);
      for (const address of this.#cc) mailableOrMessage.cc(address);
      for (const address of this.#bcc) mailableOrMessage.bcc(address);
      message = mailableOrMessage.build();
    } else {
      message = await this.#manager.resolve(mailableOrMessage);
      for (const address of this.#to) {
        message.to.push(MailValidator.parseAddress(address));
      }
      for (const address of this.#cc) {
        message.cc.push(MailValidator.parseAddress(address));
      }
      for (const address of this.#bcc) {
        message.bcc.push(MailValidator.parseAddress(address));
      }
    }

    return this.#manager.sendMessage(message, this.#mailer);
  }
}
