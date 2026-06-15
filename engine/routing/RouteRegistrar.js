/**
 * Route facade — Taand Route:: equivalent.
 *
 *   route.get('/', 'HomeController@index');
 *   route.post('/users', 'UserController@store');
 */
export class RouteRegistrar {
  constructor(router) {
    this.#router = router;
  }

  #router;

  group(attributes, callback) {
    return this.#router.group(attributes, callback);
  }

  get(uri, action) {
    return this.#router.get(uri, action);
  }

  post(uri, action) {
    return this.#router.post(uri, action);
  }

  put(uri, action) {
    return this.#router.put(uri, action);
  }

  patch(uri, action) {
    return this.#router.patch(uri, action);
  }

  delete(uri, action) {
    return this.#router.delete(uri, action);
  }

  options(uri, action) {
    return this.#router.options(uri, action);
  }

  match(methods, uri, action) {
    return this.#router.match(methods, uri, action);
  }

  any(uri, action) {
    return this.#router.any(uri, action);
  }

  redirect(from, to, status = 302) {
    return this.#router.redirect(from, to, status);
  }

  fallback(action) {
    return this.#router.fallback(action);
  }

  url(name, params = {}) {
    return this.#router.url(name, params);
  }
}
