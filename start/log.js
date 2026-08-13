import { app } from './app.js';

/**
 * Log helper — Taand's Log facade equivalent.
 *
 *   log.info('User created', { userId: 1 });
 *   log.error('Payment failed', { error: err });
 *   log.channel('daily').warning('Disk space low');
 */
const log = new Proxy({}, {
  get(_target, prop) {
    const manager = app.make('log');
    if (prop === 'channel') {
      return (name) => manager.channel(name);
    }
    if (typeof manager[prop] === 'function') {
      return manager[prop].bind(manager);
    }
    return manager[prop];
  },
});

export default log;
