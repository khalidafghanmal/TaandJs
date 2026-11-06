const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CRLF_RE = /[\r\n]/;
const NON_ASCII_RE = /[^\x20-\x7e]/;

/**
 * Email validation and header-injection prevention.
 */
export class MailValidator {
  static validateAddress(address) {
    const email = MailValidator.#normalizeAddress(address);
    if (!EMAIL_RE.test(email)) {
      throw new Error(`[Taand] Invalid email address: ${address}`);
    }
    return email;
  }

  static validateAddresses(list) {
    return (list ?? []).map((item) => MailValidator.validateAddress(item));
  }

  static sanitizeHeader(value, field = 'header') {
    const text = String(value ?? '').trim();
    if (!text) return '';
    if (CRLF_RE.test(text)) {
      throw new Error(`[Taand] Header injection blocked in ${field}`);
    }
    return text;
  }

  static parseAddress(input) {
    if (typeof input === 'string') {
      const match = input.match(/^(.+?)\s*<([^>]+)>$/);
      if (match) {
        return {
          name: MailValidator.sanitizeHeader(match[1].replace(/^["']|["']$/g, ''), 'name'),
          email: MailValidator.validateAddress(match[2]),
        };
      }
      return { name: '', email: MailValidator.validateAddress(input) };
    }

    if (input && typeof input === 'object') {
      return {
        name: MailValidator.sanitizeHeader(input.name ?? '', 'name'),
        email: MailValidator.validateAddress(input.email ?? input.address ?? ''),
      };
    }

    throw new Error('[Taand] Invalid mail address format');
  }

  static formatAddress({ name, email }) {
    if (!name) return email;
    if (NON_ASCII_RE.test(name)) return `${MailValidator.encodeWord(name)} <${email}>`;
    return `"${name.replace(/[\\"]/g, '\\$&')}" <${email}>`;
  }

  // RFC 2047 UTF-8 base64 encoded-words, split on character boundaries and folded so each line stays short.
  static encodeWord(text) {
    if (!NON_ASCII_RE.test(text)) return text;
    const chunks = [''];
    for (const char of text) {
      if (Buffer.byteLength(chunks.at(-1) + char) > 39) chunks.push('');
      chunks[chunks.length - 1] += char;
    }
    return chunks.map((chunk) => `=?UTF-8?B?${Buffer.from(chunk).toString('base64')}?=`).join('\r\n ');
  }

  static #normalizeAddress(address) {
    return String(address ?? '').trim().toLowerCase();
  }
}
