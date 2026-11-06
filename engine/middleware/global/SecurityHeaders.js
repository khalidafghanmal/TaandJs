import { Middleware } from '../Middleware.js';
import { Response } from '../../http/Response.js';

/**
 * Adds hardened security headers to every response.
 */
export class SecurityHeaders extends Middleware {
  handle(request, next) {
    return next(request);
  }

  async terminate(request, response) {
    if (!(response instanceof Response)) return;

    // Browsers ignore HSTS over plain HTTP, and sending it from local dev would pin localhost.
    const hsts = this.app.make('config').get('hsts', {}) ?? {};
    if (hsts.enabled && request.secure()) {
      response.headers['Strict-Transport-Security'] ??= hsts.includeSubDomains
        ? `max-age=${hsts.maxAge ?? 31536000}; includeSubDomains`
        : `max-age=${hsts.maxAge ?? 31536000}`;
    }

    response.headers['Content-Security-Policy'] ??= "default-src 'self'; frame-ancestors 'none'";
    response.headers['Permissions-Policy'] ??= 'camera=(), microphone=(), geolocation=()';
    response.headers['Cross-Origin-Opener-Policy'] ??= 'same-origin';
    response.headers['Cross-Origin-Resource-Policy'] ??= 'same-origin';
  }
}
