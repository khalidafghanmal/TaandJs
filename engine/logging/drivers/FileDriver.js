import fs from 'node:fs';
import path from 'node:path';
import { LogFormatter } from '../LogFormatter.js';
import { resolveLogPath } from '../resolveLogPath.js';

const DEFAULT_MAX_BYTES = 10 * 1024 * 1024;

export class FileDriver {
  constructor(app, { path: logPath, level = 'debug', maxBytes = DEFAULT_MAX_BYTES } = {}) {
    this.app = app;
    this.level = level;
    this.#maxBytes = maxBytes;
    this.#file = resolveLogPath(app.basePath, logPath ?? 'storage/logs/taand.log');
    this.#formatter = new LogFormatter();
  }

  #file;
  #maxBytes;
  #formatter;
  #queue = Promise.resolve();

  write(record) {
    const line = this.#formatter.format(record, { json: true });
    this.#queue = this.#queue.then(() => this.#append(line)).catch(() => {});
  }

  flush() {
    return this.#queue;
  }

  async #append(line) {
    await this.#rotateIfNeeded();
    await fs.promises.appendFile(this.#file, line, { encoding: 'utf8', mode: 0o640 });
  }

  async #rotateIfNeeded() {
    try {
      const stat = await fs.promises.stat(this.#file);
      if (stat.size < this.#maxBytes) return;

      const rotated = `${this.#file}.${Date.now()}`;
      await fs.promises.rename(this.#file, rotated);
      await this.#pruneRotated();
    } catch (err) {
      if (err.code !== 'ENOENT') throw err;
    }
  }

  async #pruneRotated() {
    const dir = path.dirname(this.#file);
    const base = path.basename(this.#file);
    const files = await fs.promises.readdir(dir);
    const rotated = files
      .filter((name) => name.startsWith(`${base}.`))
      .sort()
      .reverse();

    for (const name of rotated.slice(5)) {
      await fs.promises.unlink(path.join(dir, name)).catch(() => {});
    }
  }
}
