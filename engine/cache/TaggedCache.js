/**
 * Tagged cache — invalidate groups of keys at once (beyond basic Taand file cache).
 */
export class TaggedCache {
  constructor(repository, tags) {
    this.#repo = repository;
    this.#tags = tags.map((t) => String(t));
  }

  #repo;
  #tags;

  async get(key, defaultValue = undefined) {
    return this.#repo.get(this.#taggedKey(key), defaultValue);
  }

  async put(key, value, ttl = null) {
    await this.#repo.registerTags(this.#tags, this.#taggedKey(key));
    return this.#repo.put(this.#taggedKey(key), value, ttl);
  }

  async remember(key, ttl, callback) {
    await this.#repo.registerTags(this.#tags, this.#taggedKey(key));
    return this.#repo.remember(this.#taggedKey(key), ttl, callback);
  }

  async forget(key) {
    return this.#repo.forget(this.#taggedKey(key));
  }

  async flush() {
    for (const tag of this.#tags) {
      await this.#repo.flushTag(tag);
    }
    return true;
  }

  #taggedKey(key) {
    return `tag:${this.#tags.join('|')}:${key}`;
  }
}
