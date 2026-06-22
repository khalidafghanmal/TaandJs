import { Middleware } from './Middleware.js';
import { Response } from '../http/Response.js';

/**
 * Rate limiter — uses cache/redis when configured (multi-server safe).
 */
export class ThrottleRequests extends Middleware {
  static #fallbackHits = new Map();

  constructor(app, maxAttempts = 60, decayMinutes = 1) {
    super(app);
    this.maxAttempts = Number(maxAttempts) || 60;
    this.decaySeconds = (Number(decayMinutes) || 1) * 60;
  }

  static withParams(_app, params) {
    const [max, decay] = params;
    return new ThrottleRequests(_app, max, decay);
  }

  async handle(request, next) {
    const key = `${request.ip()}:${request.method}:${request.path}`;

    if (this.app.has('rateLimiter')) {
      const limiter = this.app.make('rateLimiter');
      const hits = await limiter.hit(key, this.decaySeconds);

      if (hits > this.maxAttempts) {
        const retryAfter = await limiter.availableIn(key, this.decaySeconds);
        return this.#tooMany(request, retryAfter);
      }

      request.setAttribute('_rateLimit', {
        limit: this.maxAttempts,
        remaining: Math.max(0, this.maxAttempts - hits),
      });

      return next(request);
    }

    return this.#handleInMemory(request, next, key);
  }

  async #handleInMemory(request, next, key) {
    const now = Date.now();
    const decayMs = this.decaySeconds * 1000;
    const bucket = ThrottleRequests.#fallbackHits.get(key) ?? { count: 0, resetAt: now + decayMs };

    if (now > bucket.resetAt) {
      bucket.count = 0;
      bucket.resetAt = now + decayMs;
    }

    bucket.count += 1;
    ThrottleRequests.#fallbackHits.set(key, bucket);

    if (bucket.count > this.maxAttempts) {
      const retryAfter = Math.ceil((bucket.resetAt - now) / 1000);
      return this.#tooMany(request, retryAfter);
    }

    request.setAttribute('_rateLimit', {
      limit: this.maxAttempts,
      remaining: Math.max(0, this.maxAttempts - bucket.count),
    });

    return next(request);
  }

  #tooMany(request, retryAfter) {
    return this.app.make('errors').respond(request, 429, {
      headers: {
        'Retry-After': String(retryAfter),
        'X-RateLimit-Limit': String(this.maxAttempts),
        'X-RateLimit-Remaining': '0',
      },
    });
  }

  async terminate(request, response) {
    const meta = request.attribute('_rateLimit');
    if (!meta || !(response instanceof Response)) return;

    response.headers['X-RateLimit-Limit'] = String(meta.limit);
    response.headers['X-RateLimit-Remaining'] = String(meta.remaining);
  }
}
