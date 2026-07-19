import fs from 'node:fs';
import path from 'node:path';
import { deserializeValue, hashKey, isExpired, serializeValue, ttlToExpiry } from '../CacheSerializer.js';
import { resolveCachePath } from '../resolveCachePath.js';

/**
 * File cache driver — persistent, atomic writes, hashed paths.
 */
export class FileDriver {
  constructor(app, { path: cachePath = 'storage/cache/data' } = {}) {
    this.#dir = resolveCachePath(app.basePath, cachePath);
    this.#index = new Map();
  }

  #dir;
  #index;

  async get(key) {
    const file = this.#fileFor(key);
    let raw;

    try {
      raw = await fs.promises.readFile(file, 'utf8');
    } catch (err) {
      if (err.code === 'ENOENT') return undefined;
      throw err;
    }

    const entry = deserializeValue(raw);
    if (!entry || isExpired(entry.expires)) {
      await this.forget(key);
      return undefined;
    }

    this.#index.set(key, { file, expires: entry.expires, size: raw.length });
    return entry.value;
  }

  async put(key, value, ttl = null) {
    const file = this.#fileFor(key);
    const payload = serializeValue({
      expires: ttlToExpiry(ttl),
      value,
      stored: Date.now(),
      key,
    });

    const tmp = `${file}.${process.pid}.tmp`;
    await fs.promises.mkdir(path.dirname(file), { recursive: true, mode: 0o750 });
    await fs.promises.writeFile(tmp, payload, { encoding: 'utf8', mode: 0o640 });
    await fs.promises.rename(tmp, file);

    this.#index.set(key, { file, expires: ttlToExpiry(ttl), size: payload.length });
    return true;
  }

  async add(key, value, ttl = null) {
    if ((await this.get(key)) !== undefined) return false;
    await this.put(key, value, ttl);
    return true;
  }

  async forget(key) {
    const file = this.#fileFor(key);
    this.#index.delete(key);
    try {
      await fs.promises.unlink(file);
      return true;
    } catch (err) {
      if (err.code === 'ENOENT') return false;
      throw err;
    }
  }

  async flush() {
    this.#index.clear();
    await this.#clearDir(this.#dir);
    return true;
  }

  async increment(key, amount = 1, ttl = null) {
    const file = this.#fileFor(key);
    let current = 0;
    let nextTtl = ttl;

    try {
      const raw = await fs.promises.readFile(file, 'utf8');
      const entry = deserializeValue(raw);
      if (entry && !isExpired(entry.expires)) {
        current = Number(entry.value) || 0;
        if (entry.expires != null) {
          nextTtl = Math.max(1, Math.ceil((entry.expires - Date.now()) / 1000));
        } else {
          nextTtl = null;
        }
      }
    } catch (err) {
      if (err.code !== 'ENOENT') throw err;
    }

    const next = current + amount;
    await this.put(key, next, nextTtl);
    return next;
  }

  async keys() {
    const keys = [];
    await this.#walk(async (file) => {
      const raw = await fs.promises.readFile(file, 'utf8');
      const entry = deserializeValue(raw);
      if (entry && !isExpired(entry.expires) && entry.key) keys.push(entry.key);
    });
    return keys;
  }

  async stats() {
    let entries = 0;
    let bytes = 0;
    await this.#walk(async (file) => {
      const raw = await fs.promises.readFile(file, 'utf8');
      const entry = deserializeValue(raw);
      if (entry && !isExpired(entry.expires)) {
        entries += 1;
        bytes += raw.length;
      }
    });
    return { entries, bytes };
  }

  #fileFor(key) {
    const hash = hashKey(key);
    return path.join(this.#dir, hash.slice(0, 2), `${hash.slice(2)}.cache`);
  }

  async #walk(fn) {
    const stack = [this.#dir];
    while (stack.length) {
      const dir = stack.pop();
      let entries;
      try {
        entries = await fs.promises.readdir(dir, { withFileTypes: true });
      } catch {
        continue;
      }

      for (const entry of entries) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          stack.push(full);
        } else if (entry.name.endsWith('.cache')) {
          await fn(full);
        }
      }
    }
  }

  async #clearDir(dir) {
    let entries;
    try {
      entries = await fs.promises.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await this.#clearDir(full);
        await fs.promises.rmdir(full).catch(() => {});
      } else {
        await fs.promises.unlink(full).catch(() => {});
      }
    }
  }
}
