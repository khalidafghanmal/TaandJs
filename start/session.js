import { app } from './app.js';

/**
 * Session helper — Taand's session helper / facade style.
 *
 * Low-level (store API):
 *   const store = session; // proxy to app.make('session')
 *
 * Request-aware convenience:
 *   const s = session.for(req);
 *   s.get('key');
 *   s.put('key', 'value');
 *   s.flash('status', 'Saved');
 */
const session = new Proxy({}, {
  get(_target, prop) {
    const store = app.make('session');

    if (prop === 'for') {
      return (request) => {
        const bag = request?.attribute?.('_session');

        return {
          id() {
            return bag?.id ?? null;
          },
          all() {
            return bag ? store.read(bag) : {};
          },
          get(key, fallback = null) {
            return bag ? store.get(bag, key, fallback) : fallback;
          },
          put(key, value) {
            if (!bag) return null;
            store.put(bag, key, value);
            return value;
          },
          forget(key) {
            if (!bag) return null;
            store.forget(bag, key);
            return true;
          },
          pull(key, fallback = null) {
            return bag ? store.pull(bag, key, fallback) : fallback;
          },
          flash(key, value) {
            if (!bag) return null;
            store.flash(bag, key, value);
            return value;
          },
          regenerate() {
            if (!bag) return null;
            store.regenerate(bag);
            return bag.id;
          },
        };
      };
    }

    if (typeof store[prop] === 'function') {
      return store[prop].bind(store);
    }

    return store[prop];
  },
});

export default session;
