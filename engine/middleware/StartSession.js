import crypto from 'node:crypto';
import { Middleware } from './Middleware.js';
import { Response } from '../http/Response.js';

/**
 * Starts the session — loads cookie, attaches to request, saves on terminate.
 */
export class StartSession extends Middleware {
  async handle(request, next) {
    const sessions = this.app.make('session');
    const session = await Promise.resolve(sessions.load(request));
    request.setAttribute('_session', session);

    if (!sessions.get(session, '_csrf')) {
      sessions.put(session, '_csrf', crypto.randomBytes(32).toString('hex'));
    }

    const auth = this.app.make('auth').forRequest(request);
    await auth.authenticateFromRemember();

    return next(request);
  }

  async terminate(request, response) {
    const session = request.attribute('_session');
    if (!session) return;

    const sessions = this.app.make('session');
    await Promise.resolve(sessions.commit(session, response));

    const rememberCookie = request.attribute('_remember_cookie');
    if (rememberCookie) {
      Response.appendCookie(response, rememberCookie);
    }
  }
}
