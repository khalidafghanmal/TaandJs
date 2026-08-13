import { app } from './app.js';

/**
 * Mail helper — Taand's Mail facade equivalent.
 *
 *   await mail.to('user@example.com').send(new WelcomeMail(user));
 *   await mail.send(WelcomeMail);
 */
const mail = new Proxy({}, {
  get(_target, prop) {
    const manager = app.make('mail');
    if (prop === 'mailer') {
      return (name) => ({
        to: (...addresses) => manager.to(...addresses).mailer(name),
        send: (m) => manager.to().mailer(name).send(m),
      });
    }
    if (typeof manager[prop] === 'function') {
      return manager[prop].bind(manager);
    }
    return manager[prop];
  },
});

export default mail;
