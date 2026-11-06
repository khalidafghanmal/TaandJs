import { Middleware } from './Middleware.js';
import { Response } from '../http/Response.js';
import { lockoutKeyFromRequest } from '../support/LockoutKey.js';

const AUTH_RETURN_PATHS = ['/login', '/register', '/forgot-password', '/reset-password'];

/**
 * Credential lockout — brute-force guard for login-style routes.
 * Use on routes: lockout:5,1  (5 failures, 1 minute decay)
 *
 * Unlike throttle (IP + path), lockout keys by identity field + IP.
 * Every attempt is reserved up front; a successful login clears the counter.
 */
export class LockoutRequests extends Middleware {
  static #fallbackHits = new Map();

  constructor(app, maxAttempts = 5, decayMinutes = 1, identityField = 'email') {
    super(app);
    this.maxAttempts = Number(maxAttempts) || 5;
    this.decaySeconds = (Number(decayMinutes) || 1) * 60;
    this.identityField = identityField || 'email';
  }

  static withParams(_app, params) {
    const [max, decay, field] = params;
    return new LockoutRequests(_app, max, decay, field);
  }

  async handle(request, next) {
    const key = lockoutKeyFromRequest(request, this.identityField);

    // Reserve the attempt before the (slow) credential check runs, so parallel
    // requests cannot all pass a check that is only updated afterwards.
    const hits = await this.#recordAttempt(key);
    if (hits > this.maxAttempts) {
      return this.#tooMany(request, await this.#retryAfter(key));
    }

    request.setAttribute('_lockoutKey', key);
    request.setAttribute('_lockoutHits', hits);
    return next(request);
  }

  async terminate(request, response) {
    const key = request.attribute('_lockoutKey');
    if (!key) return;

    if (this.#isSuccess(request, response)) {
      await this.#clear(key);
      return;
    }

    if (response instanceof Response) {
      const hits = request.attribute('_lockoutHits') ?? this.maxAttempts;
      response.headers['X-Lockout-Limit'] = String(this.maxAttempts);
      response.headers['X-Lockout-Remaining'] = String(Math.max(0, this.maxAttempts - hits));
    }
  }

  async #recordAttempt(key) {
    if (this.app.has('rateLimiter')) {
      return this.app.make('rateLimiter').hit(key, this.decaySeconds);
    }
    return this.#hitInMemory(key);
  }

  async #retryAfter(key) {
    if (this.app.has('rateLimiter')) {
      return this.app.make('rateLimiter').availableIn(key, this.decaySeconds);
    }
    return this.#inMemoryRetryIn(key);
  }

  async #clear(key) {
    if (this.app.has('rateLimiter')) {
      await this.app.make('rateLimiter').clear(key);
      return;
    }
    LockoutRequests.#fallbackHits.delete(key);
  }

  #isSuccess(request, response) {
    if (request.attribute('_lockoutClear')) return true;
    if (!(response instanceof Response)) return false;

    const status = response.status;
    if (status >= 200 && status < 300) return true;

    if (status >= 300 && status < 400) {
      const location = this.#location(response);
      if (!location) return false;
      return !AUTH_RETURN_PATHS.some((p) => location === p || location.startsWith(`${p}?`));
    }

    return false;
  }

  #location(response) {
    return String(response.headers?.Location ?? response.headers?.location ?? '');
  }

  #tooMany(request, retryAfter) {
    return this.app.make('errors').respond(request, 429, {
      headers: {
        'Retry-After': String(retryAfter),
        'X-Lockout-Limit': String(this.maxAttempts),
        'X-Lockout-Remaining': '0',
      },
    });
  }

  #inMemoryRetryIn(key) {
    const bucket = LockoutRequests.#fallbackHits.get(key);
    if (!bucket) return this.decaySeconds;
    return Math.max(1, Math.ceil((bucket.resetAt - Date.now()) / 1000));
  }

  #hitInMemory(key) {
    const now = Date.now();
    const decayMs = this.decaySeconds * 1000;
    const bucket = LockoutRequests.#fallbackHits.get(key) ?? { count: 0, resetAt: now + decayMs };

    if (now > bucket.resetAt) {
      bucket.count = 0;
      bucket.resetAt = now + decayMs;
    }

    bucket.count += 1;
    LockoutRequests.#fallbackHits.set(key, bucket);
    return bucket.count;
  }
}
