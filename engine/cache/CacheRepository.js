import { CacheLock } from './CacheLock.js';
import { TaggedCache } from './TaggedCache.js';
import { isExpired } from './CacheSerializer.js';

/**
 * Cache repository — primary API for get/put/remember/locks/stats.
 */
export class CacheRepository {
  constructor(app, driver, { prefix = '', store = 'default' } = {}) {
    this.app = app;
    this.#driver = driver;
    this.#prefix = prefix;
    this.#store = store;
    this.#stats = { hits: 0, misses: 0, writes: 0 };
    this.#memo = new Map();
    this.#tagIndex = new Map();
    this.#flexiblePending = new Set();
  }

  #driver;
  #prefix;
  #store;
  #stats;
  #memo;
  #tagIndex;
  #flexiblePending;

  storeName() {
    return this.#store;
  }

  stats() {
    const total = this.#stats.hits + this.#stats.misses;
    return {
      ...this.#stats,
      hitRate: total > 0 ? Math.round((this.#stats.hits / total) * 1000) / 10 : 0,
    };
  }

  async driverStats() {
    return this.#driver.stats?.() ?? { entries: 0, bytes: 0 };
  }

  async keys(limit = 100) {
    const all = await this.#driver.keys?.() ?? [];
    return all.slice(0, limit);
  }

  async get(key, defaultValue = undefined) {
    const full = this.#key(key);
    const value = await this.#driver.get(full);

    if (value === undefined) {
      this.#stats.misses += 1;
      await this.#fire('cache.miss', { key: full, store: this.#store });
      return typeof defaultValue === 'function' ? defaultValue() : defaultValue;
    }

    this.#stats.hits += 1;
    await this.#fire('cache.hit', { key: full, store: this.#store });
    return value;
  }

  async many(keys) {
    const result = {};
    for (const key of keys) {
      result[key] = await this.get(key);
    }
    return result;
  }

  async put(key, value, ttl = null) {
    const full = this.#key(key);
    this.#stats.writes += 1;
    await this.#driver.put(full, value, ttl);
    await this.#fire('cache.write', { key: full, store: this.#store, ttl });
    return true;
  }

  async putMany(values, ttl = null) {
    for (const [key, value] of Object.entries(values)) {
      await this.put(key, value, ttl);
    }
    return true;
  }

  async add(key, value, ttl = null) {
    if (await this.has(key)) return false;
    await this.put(key, value, ttl);
    return true;
  }

  forever(key, value) {
    return this.put(key, value, null);
  }

  async remember(key, ttl, callback) {
    const full = this.#key(key);
    const existing = await this.#driver.get(full);
    if (existing !== undefined) {
      this.#stats.hits += 1;
      return existing;
    }

    const value = await callback();
    await this.put(key, value, ttl);
    return value;
  }

  async rememberForever(key, callback) {
    return this.remember(key, null, callback);
  }

  /**
   * Stale-while-revalidate — serve stale up to maxStale seconds while refreshing in background.
   */
  async flexible(key, ttlPair, callback) {
    const [fresh, maxStale] = Array.isArray(ttlPair) ? ttlPair : [ttlPair, ttlPair * 5];
    const metaKey = this.#key(`${key}:flex`);
    const meta = await this.#driver.get(metaKey);

    if (meta && !isExpired(meta.freshUntil)) {
      this.#stats.hits += 1;
      return meta.value;
    }

    if (meta && !isExpired(meta.staleUntil)) {
      this.#stats.hits += 1;
      if (!this.#flexiblePending.has(metaKey)) {
        this.#flexiblePending.add(metaKey);
        setImmediate(async () => {
          try {
            const value = await callback();
            await this.#writeFlexible(metaKey, key, value, fresh, maxStale);
          } catch (error) {
            // Nothing awaits this refresh, so a rejection here would crash the process.
            if (this.app.has('exceptions')) {
              this.app.make('exceptions').report(error);
            } else if (this.app.debug) {
              console.error('[Taand] Cache flexible refresh failed', error);
            }
          } finally {
            this.#flexiblePending.delete(metaKey);
          }
        });
      }
      return meta.value;
    }

    const value = await callback();
    await this.#writeFlexible(metaKey, key, value, fresh, maxStale);
    return value;
  }

  async #writeFlexible(metaKey, key, value, fresh, maxStale) {
    const now = Date.now();
    await this.#driver.put(metaKey, {
      value,
      freshUntil: now + fresh * 1000,
      staleUntil: now + maxStale * 1000,
    }, maxStale);
    await this.put(key, value, maxStale);
    this.#stats.writes += 1;
  }

  memo(key, callback) {
    if (this.#memo.has(key)) return this.#memo.get(key);
    const value = callback();
    this.#memo.set(key, value);
    return value;
  }

  async pull(key, defaultValue = undefined) {
    const value = await this.get(key, defaultValue);
    await this.forget(key);
    return value;
  }

  async has(key) {
    return (await this.#driver.get(this.#key(key))) !== undefined;
  }

  async missing(key) {
    return !(await this.has(key));
  }

  async forget(key) {
    const full = this.#key(key);
    await this.#driver.forget(full);
    await this.#fire('cache.forget', { key: full, store: this.#store });
    return true;
  }

  async flush() {
    await this.#driver.flush();
    this.#tagIndex.clear();
    this.#memo.clear();
    await this.#fire('cache.flush', { store: this.#store });
    return true;
  }

  async increment(key, amount = 1, ttl = null) {
    return this.#driver.increment(this.#key(key), amount, ttl);
  }

  async ttl(key) {
    if (typeof this.#driver.ttl === 'function') {
      return this.#driver.ttl(this.#key(key));
    }
    return -1;
  }

  async decrement(key, amount = 1) {
    return this.increment(key, -amount);
  }

  lock(key, seconds = 10, owner = null) {
    return new CacheLock(this.#driver, this.#key(key), seconds, owner);
  }

  tags(...tags) {
    return new TaggedCache(this, tags);
  }

  registerTags(tags, fullKey) {
    for (const tag of tags) {
      if (!this.#tagIndex.has(tag)) this.#tagIndex.set(tag, new Set());
      this.#tagIndex.get(tag).add(fullKey);
    }
  }

  async flushTag(tag) {
    const keys = this.#tagIndex.get(tag) ?? new Set();
    for (const key of keys) {
      await this.#driver.forget(key);
    }
    this.#tagIndex.delete(tag);
  }

  #key(key) {
    return this.#prefix ? `${this.#prefix}${key}` : String(key);
  }

  async #fire(name, payload) {
    if (!this.app.has('events')) return;
    await this.app.make('events').dispatch(name, payload).catch(() => {});
  }
}
