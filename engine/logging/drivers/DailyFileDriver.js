import fs from 'node:fs';
import path from 'node:path';
import { LogFormatter } from '../LogFormatter.js';
import { resolveLogPath } from '../resolveLogPath.js';

export class DailyFileDriver {
  constructor(app, { path: logPath, level = 'debug', days = 14 } = {}) {
    this.app = app;
    this.level = level;
    this.#days = Math.max(1, Number(days) || 14);
    this.#baseFile = resolveLogPath(app.basePath, logPath ?? 'storage/logs/taand.log');
    this.#formatter = new LogFormatter();
  }

  #baseFile;
  #days;
  #formatter;
  #queue = Promise.resolve();
  #currentDate = '';

  write(record) {
    const line = this.#formatter.format(record, { json: true });
    this.#queue = this.#queue.then(() => this.#append(line)).catch(() => {});
  }

  flush() {
    return this.#queue;
  }

  #fileForDate(date = new Date()) {
    const stamp = date.toISOString().slice(0, 10);
    const dir = path.dirname(this.#baseFile);
    const base = path.basename(this.#baseFile, path.extname(this.#baseFile));
    const ext = path.extname(this.#baseFile) || '.log';
    return path.join(dir, `${base}-${stamp}${ext}`);
  }

  async #append(line) {
    const today = new Date().toISOString().slice(0, 10);
    if (today !== this.#currentDate) {
      this.#currentDate = today;
      await this.#pruneOld();
    }

    const file = this.#fileForDate();
    await fs.promises.appendFile(file, line, { encoding: 'utf8', mode: 0o640 });
  }

  async #pruneOld() {
    const dir = path.dirname(this.#baseFile);
    const base = path.basename(this.#baseFile, path.extname(this.#baseFile));
    const ext = path.extname(this.#baseFile) || '.log';
    const prefix = `${base}-`;
    const cutoff = Date.now() - this.#days * 24 * 60 * 60 * 1000;

    let files;
    try {
      files = await fs.promises.readdir(dir);
    } catch {
      return;
    }

    for (const name of files) {
      if (!name.startsWith(prefix) || !name.endsWith(ext)) continue;
      const file = path.join(dir, name);
      const stat = await fs.promises.stat(file).catch(() => null);
      if (stat && stat.mtimeMs < cutoff) {
        await fs.promises.unlink(file).catch(() => {});
      }
    }
  }
}
