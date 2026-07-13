import { SessionStore } from '../auth/SessionStore.js';
import { RedisSessionStore } from '../auth/RedisSessionStore.js';

/**
 * Session store factory — file (default) or redis for multi-server.
 */
export function createSessionStore(app) {
  const driver = app.make('config').get('auth.session.driver', 'file');
  if (driver === 'redis') {
    return new RedisSessionStore(app);
  }
  return new SessionStore(app);
}
