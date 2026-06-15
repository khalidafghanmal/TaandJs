import { Route } from './Route.js';

/**
 * Route storage — O(1) static lookup, compiled dynamic matching, named routes.
 */
export class RouteCollection {
  #staticRoutes = new Map();
  #dynamicRoutes = new Map();
  #namedRoutes = new Map();

  add(route) {
    for (const method of route.methods) {
      if (route.isStatic) {
        if (!this.#staticRoutes.has(method)) {
          this.#staticRoutes.set(method, new Map());
        }
        this.#staticRoutes.get(method).set(route.uri, route);
      } else {
        if (!this.#dynamicRoutes.has(method)) {
          this.#dynamicRoutes.set(method, []);
        }
        this.#dynamicRoutes.get(method).push(route);
      }
    }

    if (route.routeName) {
      this.#namedRoutes.set(route.routeName, route);
    }

    return route;
  }

  registerName(route) {
    if (route.routeName) {
      this.#namedRoutes.set(route.routeName, route);
    }
  }

  getByName(name) {
    return this.#namedRoutes.get(name) ?? null;
  }

  clear() {
    this.#staticRoutes.clear();
    this.#dynamicRoutes.clear();
    this.#namedRoutes.clear();
  }

  match(method, path) {
    const normalizedPath = Route.normalizeUri(path);

    const staticMap = this.#staticRoutes.get(method);
    if (staticMap?.has(normalizedPath)) {
      return { route: staticMap.get(normalizedPath), params: {} };
    }

    if (method === 'HEAD') {
      const getStatic = this.#staticRoutes.get('GET');
      if (getStatic?.has(normalizedPath)) {
        return { route: getStatic.get(normalizedPath), params: {} };
      }
    }

    const dynamic = this.#dynamicRoutes.get(method) ?? [];
    const headDynamic = method === 'HEAD' ? (this.#dynamicRoutes.get('GET') ?? []) : [];

    for (const route of [...dynamic, ...headDynamic]) {
      const params = route.matches(method === 'HEAD' ? 'GET' : method, normalizedPath);
      if (params !== null) {
        return { route, params };
      }
    }

    return null;
  }

  matchPath(path) {
    const normalizedPath = Route.normalizeUri(path);
    const seen = new Set();

    for (const method of Route.VERBS) {
      const result = this.match(method, normalizedPath);
      if (result && !seen.has(result.route)) {
        seen.add(result.route);
        return result;
      }
    }

    return null;
  }

  allowedMethods(path) {
    const normalizedPath = Route.normalizeUri(path);
    const methods = new Set();

    for (const method of Route.VERBS) {
      if (this.match(method, normalizedPath)) {
        methods.add(method);
      }
    }

    return [...methods];
  }

  all() {
    const routes = new Set();
    for (const map of this.#staticRoutes.values()) {
      for (const route of map.values()) routes.add(route);
    }
    for (const list of this.#dynamicRoutes.values()) {
      for (const route of list) routes.add(route);
    }
    return [...routes];
  }
}
