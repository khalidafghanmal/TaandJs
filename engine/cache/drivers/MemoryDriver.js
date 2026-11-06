import { isExpired, ttlToExpiry } from '../CacheSerializer.js';

/**
 * In-memory LRU cache — fastest driver, ideal for local dev and hot data.
 */
export class MemoryDriver {
  constructor({ maxEntries = 1000, maxBytes = 50 * 1024 * 1024 } = {}) {
    this.#store = new Map();
    this.#maxEntries = maxEntries;
    this.#maxBytes = maxBytes;
    this.#bytes = 0;
  }

  #store;
  #maxEntries;
  #maxBytes;
  #bytes;

  async get(key) {
    const entry = this.#store.get(key);
    if (!entry) return undefined;

    if (isExpired(entry.expires)) {
      this.#remove(key);
      return undefined;
    }

    this.#touch(key, entry);
    return entry.value;
  }

  async put(key, value, ttl = null) {
    const expires = ttlToExpiry(ttl);
    const size = this.#estimateSize(value);

    if (this.#store.has(key)) {
      this.#bytes -= this.#store.get(key).size;
    }

    this.#evictUntilFit(size);
    this.#store.set(key, { value, expires, size, touched: Date.now() });
    this.#bytes += size;
    this.#touch(key, this.#store.get(key));
    return true;
  }

  async add(key, value, ttl = null) {
    // Check and set before the first await, so concurrent callers cannot both win.
    const entry = this.#store.get(key);
    if (entry && !isExpired(entry.expires)) return false;
    await this.put(key, value, ttl);
    return true;
  }

  async forget(key) {
    return this.#remove(key);
  }

  async flush() {
    this.#store.clear();
    this.#bytes = 0;
    return true;
  }

  async increment(key, amount = 1, ttl = null) {
    const entry = this.#store.get(key);
    let current = 0;
    let nextTtl = ttl;

    if (entry && !isExpired(entry.expires)) {
      current = Number(entry.value) || 0;
      if (entry.expires != null) {
        nextTtl = Math.max(1, Math.ceil((entry.expires - Date.now()) / 1000));
      } else {
        nextTtl = null;
      }
    }

    const next = current + amount;
    await this.put(key, next, nextTtl);
    return next;
  }

  async keys() {
    const keys = [];
    for (const [key, entry] of this.#store) {
      if (!isExpired(entry.expires)) keys.push(key);
    }
    return keys;
  }

  async stats() {
    return { entries: this.#store.size, bytes: this.#bytes };
  }

  #touch(key, entry) {
    this.#store.delete(key);
    entry.touched = Date.now();
    this.#store.set(key, entry);
  }

  #remove(key) {
    const entry = this.#store.get(key);
    if (!entry) return false;
    this.#bytes -= entry.size;
    this.#store.delete(key);
    return true;
  }

  #estimateSize(value) {
    try {
      return JSON.stringify(value).length;
    } catch {
      return 256;
    }
  }

  #evictUntilFit(incomingSize) {
    while (
      (this.#store.size >= this.#maxEntries || this.#bytes + incomingSize > this.#maxBytes)
      && this.#store.size > 0
    ) {
      const oldest = this.#store.keys().next().value;
      this.#remove(oldest);
    }
  }
}
