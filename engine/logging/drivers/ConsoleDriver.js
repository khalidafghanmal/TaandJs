import { LogFormatter } from '../LogFormatter.js';

export class ConsoleDriver {
  constructor({ level = 'debug', stderr = false, pretty = stderr } = {}) {
    this.level = level;
    this.#stderr = stderr;
    this.#pretty = pretty;
    this.#colors = pretty && (stderr ? process.stderr : process.stdout).isTTY;
    this.#formatter = new LogFormatter();
  }

  #stderr;
  #pretty;
  #colors;
  #formatter;

  write(record) {
    const line = this.#formatter.format(record, {
      json: false,
      pretty: this.#pretty,
      colors: this.#colors,
    }).trimEnd();
    const stream = this.#stderr || record.level === 'error' || record.level === 'critical'
      ? process.stderr
      : process.stdout;
    stream.write(`${line}\n`);
  }
}
