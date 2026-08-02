import { LogChannel } from './LogChannel.js';
import { LogSanitizer } from './LogSanitizer.js';
import { LogFormatter } from './LogFormatter.js';
import { NullDriver } from './drivers/NullDriver.js';
import { ConsoleDriver } from './drivers/ConsoleDriver.js';
import { FileDriver } from './drivers/FileDriver.js';
import { DailyFileDriver } from './drivers/DailyFileDriver.js';
import { StackDriver } from './drivers/StackDriver.js';

const LEVEL_METHODS = ['emergency', 'alert', 'critical', 'error', 'warning', 'notice', 'info', 'debug'];

/**
 * Log manager — Taand's Illuminate\Log\LogManager equivalent.
 */
export class LogManager {
  constructor(app) {
    this.app = app;
    this.#channels = new Map();
    this.#sanitizer = new LogSanitizer(
      app.make('config').get('logging.sanitize', []),
    );
    this.#formatter = new LogFormatter();
    this.#defaultChannel = app.make('config').get('logging.default', 'stack');
    this.#requestContext = {};
  }

  #channels;
  #sanitizer;
  #formatter;
  #defaultChannel;
  #requestContext;

  channel(name = null) {
    const resolved = name ?? this.#defaultChannel;
    if (!this.#channels.has(resolved)) {
      this.#channels.set(resolved, this.#buildChannel(resolved));
    }
    return this.#channels.get(resolved);
  }

  setRequestContext(context) {
    this.#requestContext = { ...context };
    for (const channel of this.#channels.values()) {
      channel.mergeContext(context);
    }
    return this;
  }

  clearRequestContext() {
    this.#requestContext = {};
    for (const channel of this.#channels.values()) {
      channel.clearContext();
    }
    return this;
  }

  async flush() {
    await Promise.all([...this.#channels.values()].map((channel) => channel.flush()));
    return this;
  }

  #buildChannel(name) {
    const config = this.#channelConfig(name);
    const driver = this.#createDriver(config, name);
    const channel = new LogChannel(name, driver, {
      level: config.level ?? this.app.make('config').get('logging.level', 'debug'),
      sanitizer: this.#sanitizer,
      formatter: this.#formatter,
    });
    channel.mergeContext(this.#requestContext);
    return channel;
  }

  #channelConfig(name) {
    const channels = this.app.make('config').get('logging.channels', {});
    const config = channels[name];
    if (!config) {
      throw new Error(`[Taand] Log channel [${name}] is not defined`);
    }
    return config;
  }

  #createDriver(config, name) {
    const driver = config.driver ?? 'single';

    if (driver === 'null') return new NullDriver();
    if (driver === 'console' || driver === 'stderr') {
      return new ConsoleDriver({ level: config.level, stderr: driver === 'stderr' });
    }
    if (driver === 'single') {
      return new FileDriver(this.app, config);
    }
    if (driver === 'daily') {
      return new DailyFileDriver(this.app, config);
    }
    if (driver === 'stack') {
      const names = config.channels ?? [];
      const drivers = names.map((ch) => {
        const child = this.#channelConfig(ch);
        return this.#createDriver(child, ch);
      });
      return new StackDriver(drivers);
    }

    throw new Error(`[Taand] Unsupported log driver [${driver}] on channel [${name}]`);
  }
}

// Proxy default channel methods onto LogManager for log.info() syntax
for (const method of LEVEL_METHODS) {
  LogManager.prototype[method] = function proxyLevel(message, context) {
    return this.channel()[method](message, context);
  };
}
