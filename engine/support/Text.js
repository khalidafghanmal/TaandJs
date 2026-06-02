import { token as secureToken } from './Crypto.js';

/**
 * String helper — text('hello').slug().limit(50)
 */
export class Text {
  constructor(value = '') {
    this.value = String(value ?? '');
  }

  static make(value) {
    return new Text(value);
  }

  toString() {
    return this.value;
  }

  valueOf() {
    return this.value;
  }

  upper() {
    return new Text(this.value.toUpperCase());
  }

  lower() {
    return new Text(this.value.toLowerCase());
  }

  title() {
    return new Text(
      this.value.replace(/\w\S*/g, (word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()),
    );
  }

  slug(separator = '-') {
    return new Text(
      this.value
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, separator)
        .replace(new RegExp(`${separator}+`, 'g'), separator)
        .replace(new RegExp(`^${separator}|${separator}$`, 'g'), ''),
    );
  }

  limit(max, end = '...') {
    if (this.value.length <= max) return new Text(this.value);
    return new Text(`${this.value.slice(0, max)}${end}`);
  }

  snake() {
    return new Text(
      this.value
        .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
        .replace(/[\s-]+/g, '_')
        .toLowerCase(),
    );
  }

  camel() {
    return new Text(
      this.value
        .replace(/[_\s-]+(.)?/g, (_, c) => (c ? c.toUpperCase() : ''))
        .replace(/^./, (c) => c.toLowerCase()),
    );
  }

  contains(needle) {
    return this.value.includes(String(needle ?? ''));
  }

  startsWith(prefix) {
    return this.value.startsWith(String(prefix ?? ''));
  }

  endsWith(suffix) {
    return this.value.endsWith(String(suffix ?? ''));
  }

  mask(type = 'email') {
    if (type === 'email') {
      const [local = '', domain = ''] = this.value.split('@');
      if (!domain) return new Text(this.redact().value);
      const visible = local.slice(0, 1) || '*';
      return new Text(`${visible}***@${domain}`);
    }

    return this.redact();
  }

  redact(visible = 2) {
    const value = this.value;
    if (value.length <= visible * 2) {
      return new Text('*'.repeat(Math.max(3, value.length)));
    }
    return new Text(`${value.slice(0, visible)}${'*'.repeat(Math.max(3, value.length - visible * 2))}${value.slice(-visible)}`);
  }

  /**
   * @deprecated Use token() from start/token.js for secrets — cryptographically secure.
   */
  static random(length = 16) {
    return new Text(secureToken(Math.max(16, Math.ceil(length / 2))).slice(0, length));
  }
}

export function text(value = '') {
  return Text.make(value);
}
