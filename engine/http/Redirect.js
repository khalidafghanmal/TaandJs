import { Response } from './Response.js';

/**
 * Secure redirect response — only relative paths allowed.
 */
export class Redirect {
  constructor(url, status = 302) {
    this.url = Redirect.sanitize(url);
    this.status = status;
  }

  static to(url, status = 302) {
    return new Redirect(url, status);
  }

  static sanitize(url) {
    if (typeof url !== 'string' || !url.startsWith('/') || url.startsWith('//')) {
      throw new Error('[Taand] Redirect must be a relative path starting with /');
    }
    // Browsers strip tab/CR/LF from URLs, so "/\t/evil.com" would become "//evil.com".
    if (url.includes('..') || url.includes('\\') || /[\x00-\x1f\x7f]/.test(url)
      || new URL(url, 'http://x').host !== 'x') {
      throw new Error('[Taand] Invalid redirect path');
    }
    return url;
  }

  toResponse() {
    return new Response('', this.status, { Location: this.url });
  }
}
