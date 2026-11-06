import { Route } from './Route.js';
import { RouteCollection } from './RouteCollection.js';
import { Response } from '../http/Response.js';
import { Redirect } from '../http/Redirect.js';
import { resolveResponse } from '../http/resolveResponse.js';
import { ControllerDispatcher } from './ControllerDispatcher.js';

/**
 * Central router — full taand-style HTTP routing.
 */
export class Router {
  #collection = new RouteCollection();
  #currentRoute = null;
  #groupStack = [];
  #app = null;
  #fallback = null;

  setApplication(app) {
    this.#app = app;
  }

  get verbs() {
    return Route.VERBS;
  }

  get routes() {
    return this.#collection;
  }

  get current() {
    return this.#currentRoute;
  }

  group(attributes, callback) {
    this.#groupStack.push(attributes);
    callback();
    this.#groupStack.pop();
  }

  addRoute(methods, uri, action) {
    const valid =
      typeof action === 'function' || ControllerDispatcher.isControllerAction(action);

    if (!valid) {
      throw new TypeError('[Taand] Route action must be a function or Controller@method');
    }

    const { uri: resolvedUri, middleware, withoutMiddleware, namePrefix } = this.#mergeGroupAttributes(uri);
    const route = new Route(methods, resolvedUri, action, { middleware, withoutMiddleware, namePrefix });
    route.attachCollection(this.#collection);
    this.#collection.add(route);
    return route;
  }

  #mergeGroupAttributes(uri) {
    let prefix = '';
    let namePrefix = '';
    const middleware = [];
    const withoutMiddleware = [];

    for (const group of this.#groupStack) {
      if (group.prefix) {
        prefix += group.prefix.startsWith('/') ? group.prefix : `/${group.prefix}`;
      }
      if (group.name) {
        namePrefix += group.name.endsWith('.') ? group.name : `${group.name}.`;
      }
      if (group.middleware) {
        const items = Array.isArray(group.middleware) ? group.middleware : [group.middleware];
        middleware.push(...items);
      }
      if (group.withoutMiddleware) {
        const items = Array.isArray(group.withoutMiddleware)
          ? group.withoutMiddleware
          : [group.withoutMiddleware];
        withoutMiddleware.push(...items);
      }
    }

    const joined = `${prefix}${uri.startsWith('/') ? uri : `/${uri}`}`;
    return {
      uri: joined.replace(/\/+/g, '/'),
      middleware,
      withoutMiddleware,
      namePrefix,
    };
  }

  get(uri, action) {
    return this.addRoute(['GET', 'HEAD'], uri, action);
  }

  post(uri, action) {
    return this.addRoute('POST', uri, action);
  }

  put(uri, action) {
    return this.addRoute('PUT', uri, action);
  }

  patch(uri, action) {
    return this.addRoute('PATCH', uri, action);
  }

  delete(uri, action) {
    return this.addRoute('DELETE', uri, action);
  }

  options(uri, action) {
    return this.addRoute('OPTIONS', uri, action);
  }

  match(methods, uri, action) {
    const list = Array.isArray(methods) ? methods : [methods];
    return this.addRoute(list, uri, action);
  }

  any(uri, action) {
    return this.addRoute(Route.VERBS, uri, action);
  }

  redirect(from, to, status = 302) {
    return this.get(from, () => Redirect.to(to, status));
  }

  fallback(action) {
    this.#fallback = action;
  }

  url(name, params = {}) {
    const route = this.#collection.getByName(name);
    if (!route) {
      throw new Error(`[Taand] Route [${name}] is not defined`);
    }

    let uri = route.uri;
    for (const [key, value] of Object.entries(params)) {
      const token = `{${key}}`;
      if (uri.includes(token)) {
        uri = uri.replace(token, encodeURIComponent(String(value)));
      }
    }

    if (/\{[a-zA-Z_][a-zA-Z0-9_]*\}/.test(uri)) {
      throw new Error(`[Taand] Missing parameters for route [${name}]`);
    }

    return uri;
  }

  matchRequest(request) {
    return this.#collection.match(request.method, request.path);
  }

  async dispatch(request) {
    let matched = this.matchRequest(request);

    if (!matched) {
      const allowed = this.#collection.allowedMethods(request.path);
      if (allowed.length > 0 && !allowed.includes(request.method)) {
        const response = await this.#app.make('errors').respond(request, 405, {
          message: `Method ${request.method} is not allowed. Try: ${allowed.join(', ')}.`,
        });
        response.headers.Allow = allowed.join(', ');
        return Router.#wrap(response);
      }

      if (this.#fallback) {
        const response = await resolveResponse(await this.#runHandler(this.#fallback, request), this.#app);
        return Router.#wrap(response);
      }

      return Router.#wrap(await this.#app.make('errors').respond(request, 404));
    }

    const { route, params } = matched;
    this.#currentRoute = route;

    const req = request.withParams(params).setAttribute('_route', route);
    const pipeline = this.#pipeline;
    const run = async (r) => resolveResponse(await this.#runAction(route, r), this.#app);

    try {
      if (!pipeline || route.middlewareStack.length === 0) {
        return Router.#wrap(await run(req));
      }

      return await pipeline.send(req, route.middlewareStack, run, [], route.withoutMiddleware);
    } finally {
      request.mergeFrom(req);
    }
  }

  static #wrap(response) {
    return { response, terminate: async () => {} };
  }

  setPipeline(pipeline) {
    this.#pipeline = pipeline;
  }

  reset() {
    this.#collection.clear();
    this.#groupStack = [];
    this.#currentRoute = null;
    this.#fallback = null;
    this.#getDispatcher()?.flush();
  }

  #pipeline = null;

  #getDispatcher() {
    if (!this.#app?.has('controllers')) return null;
    return this.#app.make('controllers');
  }

  async #runAction(route, request) {
    return this.#runHandler(route.action, request);
  }

  async #runHandler(action, request) {
    if (typeof action === 'function') {
      return action(request);
    }

    const dispatcher = this.#getDispatcher();
    if (!dispatcher) {
      throw new Error('[Taand] Controller dispatcher not registered — restart the dev server');
    }

    const handler = await dispatcher.resolve(action);
    return handler(request);
  }
}
