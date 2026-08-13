import { app } from './app.js';

/**
 * Queue helper — Taand's Queue facade equivalent.
 *
 *   await dispatch(new SendWelcomeEmail(app, { userId: 1 }));
 *   await queue.later(60, job);
 */
const queue = new Proxy({}, {
  get(_target, prop) {
    const manager = app.make('queue');
    if (prop === 'connection') {
      return (name) => manager.connection(name);
    }
    if (typeof manager[prop] === 'function') {
      return manager[prop].bind(manager);
    }
    return manager[prop];
  },
});

export default async function dispatch(job) {
  return app.make('queue').dispatch(job).push();
}

export { queue };
