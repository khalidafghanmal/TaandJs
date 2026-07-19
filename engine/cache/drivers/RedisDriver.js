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
    return client.ttl(key);
  }

  async get(key) {
    const raw = await this.#redis().get(key);
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
      await this.#redis().setEx(key, seconds, payload);
    } else {
      await this.#redis().set(key, payload);
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
    const deleted = await this.#redis().del(key);
    return deleted > 0;
  }

  async flush() {
    const redis = this.#redis();
    const prefix = redis.prefix();
    const client = await redis.raw();
    const keys = await client.keys(`${prefix}*`);
    if (keys.length) await client.del(keys);
    return true;
  }

  async increment(key, amount = 1, ttl = null) {
    const existing = await this.get(key);
    const next = (Number(existing) || 0) + amount;

    let seconds = ttl;
    if (existing !== undefined) {
      const client = await this.#redis().raw();
      const ttlVal = await client.ttl(key);
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
    const redis = this.#redis();
    const prefix = redis.prefix();
    const client = await redis.raw();
    const found = await client.keys(`${prefix}*`);
    return found.slice(0, limit).map((k) => k.slice(prefix.length));
  }

  async stats() {
    const keys = await this.keys(10_000);
    return { entries: keys.length, bytes: 0 };
  }
}
