import { shouldLog } from './LogLevel.js';

/**
 * A single log channel — filters by level and writes through a driver.
 */
export class LogChannel {
  constructor(name, driver, { level = 'debug', sanitizer, formatter } = {}) {
    this.name = name;
    this.#driver = driver;
    this.#level = level;
    this.#sanitizer = sanitizer;
    this.#formatter = formatter;
    this.#context = {};
  }

  #driver;
  #level;
  #sanitizer;
  #formatter;
  #context;

  setContext(context) {
    this.#context = { ...context };
    return this;
  }

  mergeContext(context) {
    this.#context = { ...this.#context, ...context };
    return this;
  }

  clearContext() {
    this.#context = {};
    return this;
  }

  emergency(message, context = {}) { return this.#log('emergency', message, context); }
  alert(message, context = {}) { return this.#log('alert', message, context); }
  critical(message, context = {}) { return this.#log('critical', message, context); }
  error(message, context = {}) { return this.#log('error', message, context); }
  warning(message, context = {}) { return this.#log('warning', message, context); }
  notice(message, context = {}) { return this.#log('notice', message, context); }
  info(message, context = {}) { return this.#log('info', message, context); }
  debug(message, context = {}) { return this.#log('debug', message, context); }

  #log(level, message, context) {
    if (!shouldLog(level, this.#level)) return;

    const rawError = context.error;
    const merged = this.#sanitizer.sanitize({ ...this.#context, ...context });
    const error = rawError instanceof Error
      ? this.#sanitizer.sanitize(rawError)
      : undefined;

    if ('error' in merged) delete merged.error;

    const record = {
      datetime: new Date().toISOString(),
      channel: this.name,
      level,
      message: String(message),
      context: merged,
      error,
    };

    this.#driver.write(record);
  }

  flush() {
    return this.#driver.flush?.() ?? Promise.resolve();
  }
}
