/**
 * Distributed rate limiter — uses cache store (redis when configured).
 */
export class RateLimiter {
  constructor(app) {
    this.app = app;
  }

  async tooManyAttempts(key, maxAttempts) {
    const attempts = await this.attempts(key);
    return attempts >= maxAttempts;
  }

  async attempts(key) {
    const value = await this.app.make('cache').get(this.#key(key));
    return Number(value) || 0;
  }

  async hit(key, decaySeconds = 60) {
    return this.app.make('cache').increment(this.#key(key), 1, decaySeconds);
  }

  async clear(key) {
    await this.app.make('cache').forget(this.#key(key));
  }

  async availableIn(key, decaySeconds) {
    const ttl = await this.app.make('cache').store().ttl(this.#key(key));
    return ttl > 0 ? ttl : decaySeconds;
  }

  async remaining(key, maxAttempts) {
    return Math.max(0, maxAttempts - (await this.attempts(key)));
  }

  #key(key) {
    return `rate:${key}`;
  }
}
