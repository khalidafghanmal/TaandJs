import { Middleware } from '../Middleware.js';
import { Response } from '../../http/Response.js';

/**
 * Adds hardened security headers to every response.
 */
export class SecurityHeaders extends Middleware {
  handle(request, next) {
    return next(request);
  }

  async terminate(_request, response) {
    if (!(response instanceof Response)) return;

    response.headers['Content-Security-Policy'] ??= "default-src 'self'; frame-ancestors 'none'";
    response.headers['Permissions-Policy'] ??= 'camera=(), microphone=(), geolocation=()';
    response.headers['Cross-Origin-Opener-Policy'] ??= 'same-origin';
    response.headers['Cross-Origin-Resource-Policy'] ??= 'same-origin';
  }
}
