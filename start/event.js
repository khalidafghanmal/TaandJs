import { app } from './app.js';

/**
 * Event helper — Taand's Event facade equivalent.
 *
 *   await event('user.registered', user);
 *   await event.dispatch(new UserRegistered(user));
 *   event.listen('order.placed', SendReceipt);
 */
const events = new Proxy({}, {
  get(_target, prop) {
    const dispatcher = app.make('events');
    if (prop === 'listen') return dispatcher.listen.bind(dispatcher);
    if (prop === 'dispatch') return dispatcher.dispatch.bind(dispatcher);
    if (prop === 'until') return dispatcher.until.bind(dispatcher);
    if (prop === 'subscribe') return dispatcher.subscribe.bind(dispatcher);
    if (prop === 'hasListeners') return dispatcher.hasListeners.bind(dispatcher);
    if (prop === 'forget') return dispatcher.forget.bind(dispatcher);
    if (typeof dispatcher[prop] === 'function') {
      return dispatcher[prop].bind(dispatcher);
    }
    return dispatcher[prop];
  },
});

export default async function event(nameOrObject, payload) {
  return app.make('events').dispatch(nameOrObject, payload);
}

export { events };
