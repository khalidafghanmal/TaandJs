import { HttpError } from '../http/HttpError.js';

/**
 * Single route definition — Taand Route equivalent.
 */
export class Route {
  static VERBS = ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'];

  constructor(methods, uri, action, { middleware = [], withoutMiddleware = [], namePrefix = '' } = {}) {
    this.methods = Array.isArray(methods) ? methods.map((m) => m.toUpperCase()) : [methods.toUpperCase()];
    this.uri = Route.normalizeUri(uri);
    this.action = action;
    this.middlewareStack = [...middleware];
    this.withoutMiddleware = [...withoutMiddleware];
    this.routeName = null;
    this.namePrefix = namePrefix;
    this.wheres = {};
    this.#collection = null;
    this.#compile();
  }

  #collection;
  #compiled;

  attachCollection(collection) {
    this.#collection = collection;
    return this;
  }

  static normalizeUri(uri) {
    const cleaned = uri.startsWith('/') ? uri : `/${uri}`;
    return cleaned.replace(/\/+/g, '/').replace(/\/$/, '') || '/';
  }

  #compile() {
    this.#compiled = Route.compile(this.uri, this.wheres);
  }

  static compile(uri, wheres = {}) {
    const paramNames = [];
    const isStatic = !uri.includes('{');

    if (isStatic) {
      return { isStatic: true, regex: null, paramNames: [] };
    }

    const pattern = uri
      .replace(/\{([a-zA-Z_][a-zA-Z0-9_]*)\}/g, (_, name) => {
        paramNames.push(name);
        const constraint = wheres[name] ?? '[^/]+';
        Route.#assertSafePattern(constraint);
        return `(?<${name}>${constraint})`;
      })
      .replace(/\//g, '\\/');

    return {
      isStatic: false,
      regex: new RegExp(`^${pattern}\\/?$`),
      paramNames,
    };
  }

  static #assertSafePattern(pattern) {
    if (/[;`"'()]|(?:eval|Function|import|require)/i.test(pattern)) {
      throw new Error(`[Taand] Unsafe route pattern: ${pattern}`);
    }
  }

  get isStatic() {
    return this.#compiled.isStatic;
  }

  get regex() {
    return this.#compiled.regex;
  }

  get paramNames() {
    return this.#compiled.paramNames;
  }

  matches(method, path) {
    if (!this.methods.includes(method) && !(method === 'HEAD' && this.methods.includes('GET'))) {
      return null;
    }

    if (this.isStatic) {
      return path === this.uri ? {} : null;
    }

    const match = path.match(this.regex);
    if (!match) return null;

    const params = {};
    for (const name of this.paramNames) {
      if (match.groups?.[name] !== undefined) {
        try {
          params[name] = decodeURIComponent(match.groups[name]);
        } catch {
          throw HttpError.badRequest('Malformed URL encoding');
        }
      }
    }
    return params;
  }

  matchesPath(path) {
    return this.matches(this.methods[0], path) !== null
      || (!this.isStatic && path.match(this.regex) !== null)
      || (this.isStatic && path === this.uri);
  }

  name(label) {
    this.routeName = `${this.namePrefix}${label}`;
    this.#collection?.registerName(this);
    return this;
  }

  middleware(...names) {
    this.middlewareStack.push(...names.flat());
    return this;
  }

  withoutMiddleware(...names) {
    this.withoutMiddleware.push(...names.flat());
    return this;
  }

  where(name, pattern) {
    if (typeof name === 'object') {
      for (const [key, value] of Object.entries(name)) {
        this.wheres[key] = value;
      }
    } else {
      this.wheres[name] = pattern;
    }
    this.#compile();
    return this;
  }
}
