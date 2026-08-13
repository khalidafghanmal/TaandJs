import { app } from './app.js';

/**
 * Named route URL — path('users.show', { id: 1 }) → /users/1
 */
export default function path(name, params = {}) {
  return app.make('route').url(name, params);
}
