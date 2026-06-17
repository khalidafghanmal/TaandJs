import { Middleware } from './Middleware.js';

const LAYER_PATTERN = /^([a-zA-Z0-9_.-]+)(?::(.+))?$/;

/**
 * Middleware registry — groups, aliases, parameters, priority.
 * Taand Http\Kernel equivalent.
 */
export class MiddlewareRegistry {
  #handlers = new Map();
  #groups = new Map();
  #priority = [];
  #sorted = false;

  register(name, handler) {
    this.#assertHandler(handler);
    this.#handlers.set(name, handler);
    this.#sorted = false;
    return this;
  }

  group(name, stack) {
    this.#groups.set(name, stack);
    this.#sorted = false;
    return this;
  }

  alias(aliases) {
    for (const [alias, target] of Object.entries(aliases)) {
      if (!this.#handlers.has(target) && !this.#groups.has(target)) {
        throw new Error(`[Taand] Cannot alias "${alias}" to unknown middleware "${target}"`);
      }
      this.#handlers.set(alias, target);
    }
    this.#sorted = false;
    return this;
  }

  priority(order) {
    this.#priority = order;
    this.#sorted = false;
    return this;
  }

  has(name) {
    const parsed = MiddlewareRegistry.parse(name);
    return this.#handlers.has(parsed.name) || this.#groups.has(parsed.name);
  }

  static parse(layer) {
    if (typeof layer !== 'string') {
      return { raw: layer, name: null, params: [] };
    }

    const match = layer.match(LAYER_PATTERN);
    if (!match) {
      throw new Error(`[Taand] Invalid middleware name: ${layer}`);
    }

    const params = match[2] ? match[2].split(',').map((p) => p.trim()) : [];
    return { raw: layer, name: match[1], params };
  }

  expand(stack, without = []) {
    const skip = MiddlewareRegistry.#buildSkipSet(without);
    const expanded = [];

    for (const layer of stack) {
      this.#expandLayer(layer, expanded, skip, new Set());
    }

    return this.#sort(expanded);
  }

  #expandLayer(layer, expanded, skip, visiting) {
    if (typeof layer !== 'string') {
      expanded.push(layer);
      return;
    }

    const parsed = MiddlewareRegistry.parse(layer);

    if (skip.has(parsed.name) || skip.has(layer)) {
      return;
    }

    if (this.#groups.has(parsed.name)) {
      if (visiting.has(parsed.name)) {
        throw new Error(`[Taand] Circular middleware group: ${parsed.name}`);
      }

      visiting.add(parsed.name);
      for (const item of this.#groups.get(parsed.name)) {
        this.#expandLayer(item, expanded, skip, visiting);
      }
      visiting.delete(parsed.name);
      return;
    }

    expanded.push(layer);
  }

  static #buildSkipSet(without) {
    const skip = new Set();

    for (const item of without.flat()) {
      if (typeof item === 'string') {
        skip.add(MiddlewareRegistry.parse(item).name);
        skip.add(item);
      }
    }

    return skip;
  }

  #sort(stack) {
    if (!this.#priority.length) return stack;

    const order = new Map(this.#priority.map((name, index) => [name, index]));
    const indexed = stack.map((layer, index) => ({ layer, index }));

    indexed.sort((a, b) => {
      const aName = typeof a.layer === 'string' ? MiddlewareRegistry.parse(a.layer).name : null;
      const bName = typeof b.layer === 'string' ? MiddlewareRegistry.parse(b.layer).name : null;
      const aRank = aName && order.has(aName) ? order.get(aName) : Number.MAX_SAFE_INTEGER;
      const bRank = bName && order.has(bName) ? order.get(bName) : Number.MAX_SAFE_INTEGER;

      if (aRank !== bRank) return aRank - bRank;
      return a.index - b.index;
    });

    return indexed.map((item) => item.layer);
  }

  create(layer, app) {
    if (typeof layer === 'function') {
      return { handle: layer, instance: null };
    }

    const parsed = MiddlewareRegistry.parse(layer);
    const handler = this.#resolveHandler(parsed.name);

    if (!handler) {
      throw new Error(`[Taand] Middleware not registered: ${parsed.name}`);
    }

    if (typeof handler === 'function' && !MiddlewareRegistry.#isClass(handler)) {
      if (parsed.params.length) {
        return {
          handle: (req, next) => handler(req, next, ...parsed.params),
          instance: null,
        };
      }
      return { handle: handler, instance: null };
    }

    const instance = MiddlewareRegistry.#createInstance(handler, app, parsed.params);
    return {
      handle: async (req, next) => instance.handle(req, next),
      instance,
    };
  }

  static #createInstance(Handler, app, params) {
    if (Handler.withParams) {
      return Handler.withParams(app, params);
    }

    if (params.length) {
      return new Handler(app, ...params);
    }

    return new Handler(app);
  }

  static #isClass(fn) {
    return typeof fn === 'function' && fn.prototype && fn.prototype.handle;
  }

  #resolveHandler(name) {
    let handler = this.#handlers.get(name);
    const seen = new Set();

    while (typeof handler === 'string') {
      if (seen.has(handler)) {
        throw new Error(`[Taand] Circular middleware alias: ${name}`);
      }
      seen.add(handler);
      handler = this.#handlers.get(handler);
    }

    return handler;
  }

  #assertHandler(handler) {
    if (typeof handler !== 'function') {
      throw new TypeError('[Taand] Middleware must be a function or Middleware class');
    }
  }
}
