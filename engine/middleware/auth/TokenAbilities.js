import { Middleware } from '../Middleware.js';
import { Response } from '../../http/Response.js';

/**
 * Require API token abilities — Sanctum-style abilities middleware.
 * Usage: middleware('abilities:profile.read,profile.write')
 *
 * Fail-closed: session auth and machine tokens without _access_token metadata are rejected.
 */
export class TokenAbilities extends Middleware {
  constructor(app, abilities = '*') {
    super(app);
    this.abilities = String(abilities).split(',').map((a) => a.trim()).filter(Boolean);
  }

  static withParams(app, params) {
    return new TokenAbilities(app, params[0] ?? '*');
  }

  async handle(request, next) {
    const tokenMeta = request.attribute('_access_token');
    const user = request.attribute('_user');

    if (!user) {
      return Response.json({ message: 'Unauthenticated' }, 401);
    }

    if (!tokenMeta) {
      return Response.json(
        { message: 'Forbidden — token abilities require a personal or machine access token' },
        403,
      );
    }

    const tokens = this.app.make('tokens');
    const allowed = this.abilities.every((ability) => tokens.tokenCan(tokenMeta, ability));

    if (!allowed) {
      return Response.json({ message: 'Forbidden — insufficient token abilities' }, 403);
    }

    return next(request);
  }
}

export default TokenAbilities;
