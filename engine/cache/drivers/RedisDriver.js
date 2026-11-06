import { serializeValue, deserializeValue, ttlToExpiry, isExpired } from '../CacheSerializer.js';

/**
 * Redis cache driver — shared across processes, production multi-server ready.
 */
export class RedisDriver {
  constructor(app, { connection = 'default' } = {}) {
    this.app = app;
    this.#connection = connection;
  }

  #connection;

  #redis() {
    return this.app.make('redis').connection(this.#connection);
  }

  async ttl(key) {
    const client = await this.#redis().raw();
    return client.ttl(this.#prefixed(key));
  }

  async get(key) {
    const raw = await this.#redis().get(this.#prefixed(key));
    if (raw == null) return undefined;

    const entry = deserializeValue(raw);
    if (!entry || isExpired(entry.expires)) {
      await this.forget(key);
      return undefined;
    }

    return entry.value;
  }

  async put(key, value, ttl = null) {
    const payload = serializeValue({
      expires: ttlToExpiry(ttl),
      value,
      stored: Date.now(),
      key,
    });

    const seconds = ttl != null ? Math.max(1, Math.ceil(Number(ttl))) : null;

    if (seconds) {
      await this.#redis().setEx(this.#prefixed(key), seconds, payload);
    } else {
      await this.#redis().set(this.#prefixed(key), payload);
    }

    return true;
  }

  async add(key, value, ttl = null) {
    const existing = await this.get(key);
    if (existing !== undefined) return false;
    await this.put(key, value, ttl);
    return true;
  }

  async forget(key) {
    const deleted = await this.#redis().del(this.#prefixed(key));
    return deleted > 0;
  }

  async flush() {
    const client = await this.#redis().raw();
    for await (const batch of this.#scan(client)) {
      if (batch.length) await client.del(batch);
    }
    return true;
  }

  async increment(key, amount = 1, ttl = null) {
    const existing = await this.get(key);
    const next = (Number(existing) || 0) + amount;

    let seconds = ttl;
    if (existing !== undefined) {
      const client = await this.#redis().raw();
      const ttlVal = await client.ttl(this.#prefixed(key));
      if (ttlVal > 0) {
        seconds = ttlVal;
      } else if (ttlVal === -1) {
        seconds = null;
      }
    }

    await this.put(key, next, seconds);
    return next;
  }

  async keys(limit = 100) {
    const prefix = this.#redis().prefix();
    const client = await this.#redis().raw();
    const found = [];
    for await (const batch of this.#scan(client)) {
      found.push(...batch.map((k) => k.slice(prefix.length)));
      if (found.length >= limit) break;
    }
    return found.slice(0, limit);
  }

  async stats() {
    const keys = await this.keys(10_000);
    return { entries: keys.length, bytes: 0 };
  }

  #prefixed(key) {
    return `${this.#redis().prefix()}${key}`;
  }

  /** SCAN (non-blocking, unlike KEYS) over this connection's prefix, in batches. */
  async *#scan(client) {
    // Escape glob characters so the prefix is matched literally.
    const match = `${this.#redis().prefix().replace(/[*?[\]\\]/g, '\\$&')}*`;
    for await (const batch of client.scanIterator({ MATCH: match, COUNT: 500 })) {
      yield [].concat(batch);
    }
  }
}
