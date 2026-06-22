import { Middleware } from './Middleware.js';
import { Response } from '../http/Response.js';
import { Redirect } from '../http/Redirect.js';

/**
 * Guest-only middleware — redirects authenticated users away from login/register.
 */
export class GuestOnly extends Middleware {
  async handle(request, next) {
    const auth = this.app.make('auth').forRequest(request);
    await auth.loadUser();

    if (auth.check()) {
      return await this.#redirectAuthenticated(request, auth.user());
    }

    return next(request);
  }

  async #redirectAuthenticated(request, user) {
    if (request.attribute('_wantsJson')) {
      return this.app.make('errors').respond(request, 403, {
        message: 'Already authenticated',
      });
    }

    const config = this.app.make('config').get('auth', {});
    const homes = {
      admin: '/admin',
      editor: '/editor',
      user: config.routes?.home ?? '/dashboard',
    };

    const target = homes[user.role] ?? config.routes?.home ?? '/';
    return Redirect.to(target).toResponse();
  }
}
