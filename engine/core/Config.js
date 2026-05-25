/**
 * Configuration repository — resolved settings registry for the engine.
 */
export class Config {
  #items = {};

  set(key, value) {
    this.#items[key] = value;
    return this;
  }

  merge(items) {
    Object.assign(this.#items, items);
    return this;
  }

  get(key, fallback = null) {
    if (key in this.#items) return this.#items[key];

    const parts = key.split('.');
    let current = this.#items;

    for (const part of parts) {
      if (current?.[part] === undefined) return fallback;
      current = current[part];
    }

    return current;
  }

  has(key) {
    return this.get(key) !== null && this.get(key) !== undefined;
  }
}
