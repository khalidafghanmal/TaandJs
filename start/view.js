import { app } from './app.js';

/**
 * Render a TaandView template from routes or controllers.
 *
 *   return view('welcome');
 *   return view('users.index', { users: [] });
 */
export function view(name, data = {}) {
  return app.make('view.helper')(name, data);
}

export default view;
