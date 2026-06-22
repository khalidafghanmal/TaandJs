import { Middleware } from './Middleware.js';
import { Response } from '../http/Response.js';
import { Redirect } from '../http/Redirect.js';

/**
 * Authentication middleware — auth (session) or auth:api (Bearer token).
 */
export class Authenticate extends Middleware {
  constructor(app, guard = 'session') {
    super(app);
    this.guard = guard;
  }

  static withParams(app, params) {
    return new Authenticate(app, params[0] ?? 'session');
  }

  async handle(request, next) {
    const auth = this.app.make('auth').forRequest(request).guard(this.guard);
    const user = await auth.loadUser();

    if (!user) {
      return this.#unauthenticated(request);
    }

    return next(request);
  }

  #unauthenticated(request) {
    const wantsJson = request.attribute('_wantsJson') || this.guard === 'api';

    if (wantsJson) {
      return Response.json({ message: 'Unauthenticated' }, 401);
    }

    const login = this.app.make('config').get('auth.routes.login', '/login');
    const intended = request.path !== login ? request.path : null;

    if (intended) {
      const session = request.attribute('_session');
      if (session) {
        this.app.make('session').put(session, '_url.intended', intended);
      }
    }

    return Redirect.to(login).toResponse();
  }
}
