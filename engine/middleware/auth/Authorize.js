import { Middleware } from '../Middleware.js';
import { Response } from '../../http/Response.js';
/**
 * Policy / gate middleware — use as can:manage-users or can:content.manage
 */
export class Authorize extends Middleware {
  constructor(app, ability) {
    super(app);
    this.ability = ability;
  }

  static withParams(app, params) {
    return new Authorize(app, params[0]);
  }

  async handle(request, next) {
    const auth = this.app.make('auth').forRequest(request);
    const user = await auth.loadUser();

    if (!user) {
      return this.app.make('errors').respond(request, 401);
    }

    const gate = this.app.make('gate');
    const allowed = await gate.allows(this.ability, user);

    if (!allowed) {
      return await this.#forbidden(request);
    }

    return next(request);
  }

  async #forbidden(request) {
    return this.app.make('errors').respond(request, 403);
  }
}
