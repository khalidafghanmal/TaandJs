import crypto from 'node:crypto';
import { Middleware } from '../Middleware.js';
import { Response } from '../../http/Response.js';

const MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const COOKIE = 'XSRF-TOKEN';

/**
 * Double-submit CSRF — session token mirrored in HttpOnly cookie.
 */
export class CsrfProtection extends Middleware {
  async handle(request, next) {
    const token = this.#token(request);

    if (MUTATING.has(request.method)) {
      const submitted = request.input('_token') ?? request.header('x-csrf-token');
      const cookie = request.cookies()[COOKIE];

      if (!submitted || !cookie || submitted !== cookie || submitted !== token) {
        return this.app.make('errors').respond(request, 419);
      }
    }

    return next(request);
  }

  async terminate(request, response) {
    if (!(response instanceof Response) || MUTATING.has(request.method)) return;

    const token = this.#token(request);
    const secure = this.app.make('config').get('auth.session.secure', false) ? '; Secure' : '';
    Response.appendCookie(response, `${COOKIE}=${token}; Path=/; HttpOnly; SameSite=Strict${secure}`);
    response.headers['X-CSRF-TOKEN'] = token;
  }

  #token(request) {
    const session = request.attribute('_session');

    if (session) {
      const sessions = this.app.make('session');
      let token = sessions.get(session, '_csrf');

      if (!token) {
        token = crypto.randomBytes(32).toString('hex');
        sessions.put(session, '_csrf', token);
      }

      return token;
    }

    return crypto.randomBytes(32).toString('hex');
  }
}
