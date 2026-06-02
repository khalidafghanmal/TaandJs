/**
 * Lightweight list helper — bag(items) for chaining filters and maps.
 */
const UNSAFE_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

export class Bag {
  constructor(items = []) {
    this.items = Bag.#normalize(items);
  }

  static make(items) {
    return new Bag(items);
  }

  static #normalize(items) {
    if (items instanceof Bag) return [...items.items];
    if (items == null) return [];
    if (Array.isArray(items)) return [...items];
    if (typeof items === 'object') return Object.entries(items).map(([key, value]) => ({ key, value }));
    return [items];
  }

  filter(fn) {
    return new Bag(this.items.filter(fn));
  }

  map(fn) {
    return new Bag(this.items.map(fn));
  }

  pluck(key) {
    return this.items.map((item) => safeRead(item, key));
  }

  first(fallback = null) {
    return this.items.length ? this.items[0] : fallback;
  }

  last(fallback = null) {
    return this.items.length ? this.items[this.items.length - 1] : fallback;
  }

  count() {
    return this.items.length;
  }

  isEmpty() {
    return this.items.length === 0;
  }

  toArray() {
    return [...this.items];
  }

  groupBy(keyOrFn) {
    const groups = {};
    for (const item of this.items) {
      const key = resolveKey(keyOrFn, item);
      if (key == null) continue;
      if (!Object.hasOwn(groups, key)) groups[key] = [];
      groups[key].push(item);
    }
    return new Bag(Object.entries(groups).map(([key, value]) => ({ key, value })));
  }

  keyBy(keyOrFn) {
    const map = {};
    for (const item of this.items) {
      const key = resolveKey(keyOrFn, item);
      if (key == null) continue;
      map[key] = item;
    }
    return new Bag(Object.values(map));
  }

  unique(key = null) {
    const seen = new Set();
    const out = [];

    for (const item of this.items) {
      const token = key == null ? item : safeRead(item, key);
      const id = typeof token === 'object' ? JSON.stringify(token) : String(token);
      if (seen.has(id)) continue;
      seen.add(id);
      out.push(item);
    }

    return new Bag(out);
  }

  sortBy(keyOrFn) {
    const sorted = [...this.items].sort((a, b) => {
      const left = resolveKey(keyOrFn, a);
      const right = resolveKey(keyOrFn, b);
      if (left < right) return -1;
      if (left > right) return 1;
      return 0;
    });
    return new Bag(sorted);
  }

  flatten(depth = 1) {
    return new Bag(this.items.flat(depth));
  }

  where(key, value) {
    return this.filter((item) => safeRead(item, key) === value);
  }

  firstWhere(key, value) {
    return this.items.find((item) => safeRead(item, key) === value) ?? null;
  }

  [Symbol.iterator]() {
    return this.items[Symbol.iterator]();
  }
}

export function bag(items) {
  return Bag.make(items);
}

function resolveKey(keyOrFn, item) {
  const key = typeof keyOrFn === 'function' ? keyOrFn(item) : safeRead(item, keyOrFn);
  if (key == null) return null;
  if (typeof key !== 'string' && typeof key !== 'number') return null;
  return String(key);
}

function safeRead(item, key) {
  if (item == null || typeof item !== 'object') return null;
  if (typeof key !== 'string' || UNSAFE_KEYS.has(key)) return null;
  if (!Object.hasOwn(item, key)) return null;
  return item[key];
}
