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
    if (typeof entry === 'number') return entry;
    if (!entry || isExpired(entry.expires)) {
      await this.forget(key);
      return undefined;
    }

    return entry.value;
  }

  async put(key, value, ttl = null) {
    const payload = this.#payload(key, value, ttl);
    const seconds = ttl != null ? Math.max(1, Math.ceil(Number(ttl))) : null;

    if (seconds) {
      await this.#redis().setEx(key, seconds, payload);
    } else {
      await this.#redis().set(key, payload);
    }

    return true;
  }

  async add(key, value, ttl = null) {
    const options = ttl != null ? { NX: true, PX: this.#milliseconds(ttl) } : { NX: true };
    return (await this.#redis().set(key, this.#payload(key, value, ttl), options)) === 'OK';
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
    const client = await this.#redis().raw();
    if (ttl == null) return Number(await client.incrBy(key, amount));

    // SET NX seeds a new counter with its expiry; INCRBY keeps an existing counter's TTL.
    const [, next] = await client.multi()
      .set(key, '0', { NX: true, PX: this.#milliseconds(ttl) })
      .incrBy(key, amount)
      .exec();
    return Number(next);
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

  #payload(key, value, ttl) {
    // Integers are stored raw so INCRBY can update them atomically.
    if (Number.isInteger(value)) return String(value);
    return serializeValue({
      expires: ttlToExpiry(ttl),
      value,
      stored: Date.now(),
      key,
    });
  }

  #milliseconds(ttl) {
    return Math.max(1, Math.ceil(Number(ttl) * 1000));
  }
}
