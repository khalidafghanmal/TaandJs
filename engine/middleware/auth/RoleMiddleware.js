import { Middleware } from '../Middleware.js';
import { Response } from '../../http/Response.js';
import { Redirect } from '../../http/Redirect.js';

/**
 * Role gate — role:admin or role:admin,editor (any listed role).
 */
export class RoleMiddleware extends Middleware {
  constructor(app, roles = 'admin') {
    super(app);
    this.roles = String(roles)
      .split(',')
      .map((r) => r.trim())
      .filter(Boolean);
  }

  static withParams(app, params) {
    return new RoleMiddleware(app, params[0] ?? 'admin');
  }

  async handle(request, next) {
    const auth = this.app.make('auth').forRequest(request);
    const user = await auth.loadUser();

    if (!user) {
      return this.#unauthenticated(request);
    }

    if (!this.roles.includes(user.role)) {
      return await this.#forbidden(request);
    }

    return next(request);
  }

  #unauthenticated(request) {
    if (request.attribute('_wantsJson')) {
      return Response.json({ message: 'Unauthenticated' }, 401);
    }

    const login = this.app.make('config').get('auth.routes.login', '/login');
    return Redirect.to(login).toResponse();
  }

  async #forbidden(request) {
    return this.app.make('errors').respond(request, 403);
  }
}
