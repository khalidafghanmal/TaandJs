import { app } from './app.js';

/**
 * Cache helper — Taand's Cache facade equivalent.
 *
 *   await cache.put('users', data, 3600);
 *   const users = await cache.remember('users', 60, () => fetchUsers());
 *   await cache.tags('posts').flush();
 */
const cache = new Proxy({}, {
  get(_target, prop) {
    const manager = app.make('cache');
    if (prop === 'store' || prop === 'driver') {
      return (name) => manager.store(name);
    }
    if (typeof manager[prop] === 'function') {
      return manager[prop].bind(manager);
    }
    return manager[prop];
  },
});

export default cache;
