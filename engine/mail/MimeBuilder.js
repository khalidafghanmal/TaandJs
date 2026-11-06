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

    // A blank line separates the header block from the body (RFC 5322).
    return `${headers}\r\n\r\n${body}`;
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

    lines.push(message.attachments?.length
      ? `Content-Type: multipart/mixed; boundary="${this.#mixedBoundary}"`
      : this.#bodyContentType(message));

    return lines.join('\r\n');
  }

  #buildMixed(message) {
    const parts = [
      `--${this.#mixedBoundary}`,
      this.#bodyContentType(message),
      '',
      this.#buildBody(message),
    ];

    for (const file of message.attachments) {
      const content = fs.readFileSync(file.path);
      const filename = MailValidator.sanitizeHeader(file.name ?? path.basename(file.path), 'filename');
      parts.push(
        `--${this.#mixedBoundary}`,
        `Content-Type: ${file.mime ?? 'application/octet-stream'}`,
        `Content-Transfer-Encoding: base64`,
        `Content-Disposition: attachment; filename="${filename}"`,
        '',
        content.toString('base64').replace(/.{76}(?=.)/g, '$&\r\n'),
      );
    }

    parts.push(`--${this.#mixedBoundary}--`);
    return parts.join('\r\n');
  }

  #bodyContentType(message) {
    if (message.html && message.text) return `Content-Type: multipart/alternative; boundary="${this.#boundary}"`;
    if (message.html) return 'Content-Type: text/html; charset=UTF-8';
    return 'Content-Type: text/plain; charset=UTF-8';
  }

  #buildBody(message) {
    if (message.html && message.text) return this.#multipartAlternative(message);
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
}
