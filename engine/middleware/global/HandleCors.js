import { Middleware } from '../Middleware.js';
import { Response } from '../../http/Response.js';

/**
 * CORS middleware — preflight OPTIONS + Access-Control-* headers on responses.
 */
export class HandleCors extends Middleware {
  handle(request, next) {
    const config = this.app.make('config').get('cors', {});

    if (config.enabled === false || !this.#matchesPath(request.path, config.paths)) {
      return next(request);
    }

    if (request.isMethod('OPTIONS')) {
      return this.#preflight(request, config);
    }

    request.setAttribute('_cors', config);
    return next(request);
  }

  async terminate(request, response) {
    const config = request.attribute('_cors');
    if (!config || !(response instanceof Response)) return;

    this.#applyHeaders(response, request.header('origin'), config);
  }

  #preflight(request, config) {
    const origin = request.header('origin');
    const response = new Response('', 204);
    this.#applyHeaders(response, origin, config);
    response.headers['Access-Control-Allow-Methods'] = config.allowedMethods.join(', ');
    response.headers['Access-Control-Allow-Headers'] = config.allowedHeaders.join(', ');
    if (config.maxAge > 0) {
      response.headers['Access-Control-Max-Age'] = String(config.maxAge);
    }
    return response;
  }

  #applyHeaders(response, origin, config) {
    const allowed = this.#resolveOrigin(origin, config);
    if (!allowed) return;

    response.headers['Access-Control-Allow-Origin'] = allowed;
    if (config.supportsCredentials) {
      response.headers['Access-Control-Allow-Credentials'] = 'true';
    }
    if (config.exposedHeaders?.length) {
      response.headers['Access-Control-Expose-Headers'] = config.exposedHeaders.join(', ');
    }
    response.headers['Vary'] = 'Origin';
  }

  #resolveOrigin(origin, config) {
    const origins = config.allowedOrigins ?? ['*'];

    // Never reflect an arbitrary Origin when "*" is configured — that bypasses
    // the allowlist when credentials are enabled (browsers forbid "*" + credentials).
    if (origins.includes('*')) {
      if (config.supportsCredentials) return null;
      return '*';
    }

    if (!origin || !origins.includes(origin)) return null;
    return origin;
  }

  #matchesPath(pathname, patterns = []) {
    if (!patterns.length) return true;

    const path = pathname.startsWith('/') ? pathname.slice(1) : pathname;

    return patterns.some((pattern) => {
      if (pattern === '*') return true;
      if (pattern.endsWith('/*')) {
        const prefix = pattern.slice(0, -2);
        return path === prefix || path.startsWith(`${prefix}/`);
      }
      return path === pattern || `/${path}` === pattern;
    });
  }
}
