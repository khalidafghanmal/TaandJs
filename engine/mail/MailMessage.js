import path from 'node:path';
import { MailValidator } from './MailValidator.js';

/**
 * Fluent mail message builder.
 */
export class MailMessage {
  constructor(app) {
    this.app = app;
    this.#data = {
      to: [],
      cc: [],
      bcc: [],
      headers: {},
      attachments: [],
    };
  }

  #data;

  static make(app) {
    return new MailMessage(app);
  }

  from(address) {
    this.#data.from = MailValidator.parseAddress(address);
    return this;
  }

  to(...addresses) {
    this.#data.to.push(...MailMessage.#flatten(addresses).map(MailValidator.parseAddress));
    return this;
  }

  cc(...addresses) {
    this.#data.cc.push(...MailMessage.#flatten(addresses).map(MailValidator.parseAddress));
    return this;
  }

  bcc(...addresses) {
    this.#data.bcc.push(...MailMessage.#flatten(addresses).map(MailValidator.parseAddress));
    return this;
  }

  replyTo(address) {
    this.#data.replyTo = MailValidator.parseAddress(address);
    return this;
  }

  subject(value) {
    this.#data.subject = MailValidator.sanitizeHeader(value, 'Subject');
    return this;
  }

  html(content) {
    this.#data.html = String(content ?? '');
    return this;
  }

  text(content) {
    this.#data.text = String(content ?? '');
    return this;
  }

  header(key, value) {
    this.#data.headers[key] = MailValidator.sanitizeHeader(value, key);
    return this;
  }

  attach(filePath, options = {}) {
    return this.#attachWithin(filePath, this.app.basePath, options);
  }

  attachFromStorage(relativePath, options = {}) {
    const root = path.join(this.app.basePath, 'storage', 'app', 'public');
    return this.#attachWithin(path.join(root, relativePath), root, options);
  }

  #attachWithin(filePath, root, { name = null, mime = null } = {}) {
    this.#data.attachments.push({
      path: MailValidator.attachmentPath(filePath, root),
      name: name ?? path.basename(filePath),
      mime,
    });
    return this;
  }

  async view(name, data = {}) {
    const html = await this.app.make('mail.renderer').render(name, data);
    this.#data.html = html;
    if (!this.#data.text) {
      this.#data.text = MailMessage.#htmlToText(html);
    }
    return this;
  }

  markdown(name, data = {}) {
    return this.view(name, data);
  }

  build() {
    const config = this.app.make('config').get('mail', {});
    if (!this.#data.from) {
      this.#data.from = MailValidator.parseAddress({
        email: config.from?.address ?? 'hello@example.com',
        name: config.from?.name ?? 'TaandJs',
      });
    }

    if (!this.#data.to.length) {
      throw new Error('[Taand] Mail message requires at least one recipient');
    }

    if (!this.#data.subject) {
      throw new Error('[Taand] Mail message requires a subject');
    }

    if (!this.#data.html && !this.#data.text) {
      throw new Error('[Taand] Mail message requires html or text content');
    }

    return { ...this.#data };
  }

  static #flatten(addresses) {
    return addresses.flatMap((item) => (Array.isArray(item) ? item : [item]));
  }

  static #htmlToText(html) {
    return String(html)
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n\n')
      .replace(/<[^>]+>/g, '')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }
}
