import { app } from './app.js';

/**
 * Auth helper — use in controllers and routes.
 *
 *   const user = auth(req).user();
 *   await auth(req).attempt({ email, password }, remember);
 */
export default function auth(request) {
  return app.make('auth').forRequest(request);
}
