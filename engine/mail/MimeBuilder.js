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

  // 7bit is only safe for ASCII with lines under SMTP's 998-octet limit; anything else goes base64 (RFC 2045).
  static #needsBase64(text) {
    return /[^\x00-\x7f]|[^\r\n]{999}/.test(String(text ?? ''));
  }

  static #textHeaders(type, text) {
    const headers = [`Content-Type: ${type}; charset=UTF-8`];
    if (MimeBuilder.#needsBase64(text)) headers.push('Content-Transfer-Encoding: base64');
    return headers;
  }

  static #encodeText(text) {
    const value = String(text ?? '');
    if (!MimeBuilder.#needsBase64(value)) return value;
    return Buffer.from(value).toString('base64').replace(/.{76}(?=.)/g, '$&\r\n');
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
    } else {
      lines.push(...MimeBuilder.#textHeaders(message.html ? 'text/html' : 'text/plain', message.html || message.text));
    }

    return lines.join('\r\n');
  }

  #buildMixed(message) {
    const parts = [
      `--${this.#mixedBoundary}`,
      `Content-Type: multipart/alternative; boundary="${this.#boundary}"`,
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
        content.toString('base64'),
      );
    }

    parts.push(`--${this.#mixedBoundary}--`);
    return parts.join('\r\n');
  }

  #buildBody(message) {
    if (message.html && message.text) return this.#multipartAlternative(message);
    return MimeBuilder.#encodeText(message.html || message.text);
  }

  #multipartAlternative(message) {
    return [
      `--${this.#boundary}`,
      ...MimeBuilder.#textHeaders('text/plain', message.text),
      '',
      MimeBuilder.#encodeText(message.text),
      `--${this.#boundary}`,
      ...MimeBuilder.#textHeaders('text/html', message.html),
      '',
      MimeBuilder.#encodeText(message.html),
      `--${this.#boundary}--`,
    ].join('\r\n');
  }
}
