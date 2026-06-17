/**
 * Base middleware class — extend for class-based middleware with DI.
 *
 *   export class Auth extends Middleware {
 *     handle(req, next) { ... }
 *   }
 */
export class Middleware {
  constructor(app = null) {
    this.app = app;
  }

  async handle(request, next) {
    return next(request);
  }

  async terminate(_request, _response) {}
}
