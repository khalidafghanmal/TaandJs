import fs from 'node:fs';
import path from 'node:path';

/**
 * Saves .eml files to disk — inspect real MIME in dev without SMTP.
 */
export class FileDriver {
  constructor(app, { path: outbox = 'storage/mail/outbox' } = {}) {
    this.#dir = path.resolve(app.basePath, outbox);
    fs.mkdirSync(this.#dir, { recursive: true, mode: 0o750 });
    this.#records = [];
  }

  #dir;
  #records;

  async send(message, raw) {
    const id = `file_${Date.now()}_${this.#records.length}`;
    const eml = path.join(this.#dir, `${id}.eml`);
    const html = path.join(this.#dir, `${id}.html`);

    await fs.promises.writeFile(eml, raw, { encoding: 'utf8', mode: 0o640 });
    if (message.html) {
      await fs.promises.writeFile(html, message.html, { encoding: 'utf8', mode: 0o640 });
    }

    const record = { id, sentAt: new Date().toISOString(), message, eml, html: message.html ? html : null };
    this.#records.push(record);
    return { id, driver: 'file' };
  }

  all() {
    return [...this.#records];
  }

  find(id) {
    return this.#records.find((m) => m.id === id) ?? null;
  }

  flush() {
    this.#records.length = 0;
  }
}
