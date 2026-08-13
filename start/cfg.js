import { app } from './app.js';

/**
 * Settings helper — cfg('runtime.name') or legacy cfg('app.name') via engine registry.
 */
export default function cfg(key, fallback = null) {
  return app.make('config').get(key, fallback);
}
