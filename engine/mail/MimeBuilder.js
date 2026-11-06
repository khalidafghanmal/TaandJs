import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { MailValidator } from './MailValidator.js';

/**
 * Builds safe multipart MIME messages.
 */
export class MimeBuilder {
  constructor() {
    this.#boundary = `TAAND_${crypto.randomBytes(16).toString('hex')}`;
    this.#mixedBoundary = `TAAND_mixed_${crypto.randomBytes(16).toString('hex')}`;
  }

  #boundary;
  #mixedBoundary;

  build(message) {
    const headers = this.#buildHeaders(message);
    const body = message.attachments?.length
      ? this.#buildMixed(message)
      : this.#buildBody(message);

    return `${headers}\r\n${body}`;
  }

  #buildHeaders(message) {
    const lines = [
      `From: ${MailValidator.formatAddress(message.from)}`,
      `To: ${message.to.map((a) => MailValidator.formatAddress(a)).join(', ')}`,
      `Subject: ${MailValidator.sanitizeHeader(message.subject, 'Subject')}`,
      `Date: ${new Date().toUTCString()}`,
      `MIME-Version: 1.0`,
      `Message-ID: <${crypto.randomBytes(16).toString('hex')}@Taand.local>`,
    ];

    if (message.cc?.length) {
      lines.push(`Cc: ${message.cc.map((a) => MailValidator.formatAddress(a)).join(', ')}`);
    }

    if (message.replyTo) {
      lines.push(`Reply-To: ${MailValidator.formatAddress(message.replyTo)}`);
    }

    for (const [key, value] of Object.entries(message.headers ?? {})) {
      lines.push(`${MailValidator.sanitizeHeader(key, 'header')}: ${MailValidator.sanitizeHeader(value, key)}`);
    }

    if (message.attachments?.length) {
      lines.push(`Content-Type: multipart/mixed; boundary="${this.#mixedBoundary}"`);
    } else if (message.html && message.text) {
      lines.push(`Content-Type: multipart/alternative; boundary="${this.#boundary}"`);
    } else if (message.html) {
      lines.push(`Content-Type: text/html; charset=UTF-8`);
    } else {
      lines.push(`Content-Type: text/plain; charset=UTF-8`);
    }

    return lines.join('\r\n');
  }

  #buildMixed(message) {
    const parts = [
      `--${this.#mixedBoundary}`,
      `Content-Type: multipart/alternative; boundary="${this.#boundary}"`,
      '',
      this.#buildBody(message, false),
    ];

    for (const file of message.attachments) {
      const content = fs.readFileSync(file.path);
      const filename = MailValidator.sanitizeHeader(file.name ?? path.basename(file.path), 'filename');
      parts.push(
        `--${this.#mixedBoundary}`,
        `Content-Type: ${file.mime ?? 'application/octet-stream'}`,
        `Content-Transfer-Encoding: base64`,
        `Content-Disposition: attachment; ${MimeBuilder.#filenameParams(filename)}`,
        '',
        content.toString('base64'),
      );
    }

    parts.push(`--${this.#mixedBoundary}--`);
    return parts.join('\r\n');
  }

  #buildBody(message, includeHeaders = true) {
    if (message.html && message.text) {
      const parts = [];
      if (includeHeaders) return this.#multipartAlternative(message);

      parts.push(
        `--${this.#boundary}`,
        `Content-Type: text/plain; charset=UTF-8`,
        '',
        message.text,
        `--${this.#boundary}`,
        `Content-Type: text/html; charset=UTF-8`,
        '',
        message.html,
        `--${this.#boundary}--`,
      );
      return parts.join('\r\n');
    }

    if (message.html) return message.html;
    return message.text ?? '';
  }

  #multipartAlternative(message) {
    return [
      `--${this.#boundary}`,
      `Content-Type: text/plain; charset=UTF-8`,
      '',
      message.text ?? '',
      `--${this.#boundary}`,
      `Content-Type: text/html; charset=UTF-8`,
      '',
      message.html ?? '',
      `--${this.#boundary}--`,
    ].join('\r\n');
  }

  // Escaped quoted-string filename (RFC 2183); non-ASCII names add an RFC 2231 filename* with an ASCII fallback.
  static #filenameParams(name) {
    const quoted = (value) => `"${value.replace(/[\\"]/g, '\\$&')}"`;
    if (!/[^\x20-\x7e]/.test(name)) return `filename=${quoted(name)}`;

    const fallback = name.replace(/[^\x20-\x7e]/gu, '_');
    const encoded = encodeURIComponent(name).replace(/['()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
    return `filename=${quoted(fallback)}; filename*=UTF-8''${encoded}`;
  }
}
