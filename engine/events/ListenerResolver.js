import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { listenersDir } from '../core/ProjectPaths.js';
import {
  parseListenerString,
  validateClassName,
  validateListenerMethod,
  SAFE_METHODS,
} from './EventName.js';

/**
 * Resolves listeners to callable functions — blocks unsafe class/method access.
 */
export class ListenerResolver {
  constructor(app) {
    this.app = app;
    this.#cache = new Map();
    this.#listenersPath = listenersDir(app.basePath);
  }

  #cache;
  #listenersPath;

  async resolve(listener) {
    const key = this.#cacheKey(listener);
    if (this.#cache.has(key)) return this.#cache.get(key);

    const handler = await this.#resolve(listener);
    this.#cache.set(key, handler);
    return handler;
  }

  clearCache() {
    this.#cache.clear();
  }

  #cacheKey(listener) {
    if (typeof listener === 'function' && !listener.prototype) {
      return `fn:${listener.name || 'anonymous'}`;
    }
    if (Array.isArray(listener)) {
      const target = listener[0];
      return `arr:${typeof target === 'function' ? target.name : target?.constructor?.name}@${listener[1] ?? 'handle'}`;
    }
    if (typeof listener === 'string') return `str:${listener}`;
    if (typeof listener === 'function') return `cls:${listener.name}`;
    return `obj:${listener.constructor?.name}`;
  }

  async #resolve(listener) {
    if (typeof listener === 'function' && !listener.prototype) {
      return listener;
    }

    if (Array.isArray(listener)) {
      const [target, method = 'handle'] = listener;
      validateListenerMethod(method);
      if (typeof target === 'function') {
        return this.#bindMethod(new target(this.app), method);
      }
      if (typeof target === 'object' && target !== null) {
        return this.#bindMethod(target, method);
      }
      throw new Error('[Taand] Invalid listener array target');
    }

    if (typeof listener === 'string') {
      if (listener.includes('@')) {
        const { className, method } = parseListenerString(listener);
        return this.#loadClass(className, method);
      }
      return this.#loadClass(listener, 'handle');
    }

    if (typeof listener === 'function' && listener.prototype) {
      return this.#bindMethod(new listener(this.app), 'handle');
    }

    if (typeof listener === 'object' && listener !== null) {
      return this.#bindMethod(listener, 'handle');
    }

    throw new Error('[Taand] Unsupported listener type');
  }

  async #loadClass(className, method) {
    validateClassName(className);
    validateListenerMethod(method);

    const file = path.join(this.#listenersPath, `${className}.js`);

    let mod;
    try {
      mod = await import(pathToFileURL(file).href);
    } catch (err) {
      if (err.code === 'ERR_MODULE_NOT_FOUND') {
        throw new Error(`[Taand] Listener [${className}] not found in src/listeners/${className}.js`);
      }
      throw err;
    }

    const exported = mod[className] ?? mod.default;
    if (!exported) {
      throw new Error(`[Taand] Listener [${className}] is not exported from src/listeners/${className}.js`);
    }

    const instance = typeof exported === 'function' ? new exported(this.app) : exported;
    return this.#bindMethod(instance, method);
  }

  #bindMethod(instance, method) {
    validateListenerMethod(method);

    if (typeof instance[method] !== 'function') {
      throw new Error(
        `[Taand] Listener method [${method}] not found on ${instance.constructor?.name ?? 'listener'}`,
      );
    }

    if (!SAFE_METHODS.has(method) && !/^[a-z][a-zA-Z0-9]*$/.test(method)) {
      throw new Error(`[Taand] Listener method [${method}] is not allowed`);
    }

    return instance[method].bind(instance);
  }
}
