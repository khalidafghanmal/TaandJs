import { Redirect } from '../http/Redirect.js';

/**
 * Base controller — extend this for route logic.
 */
export class Controller {
  constructor(app) {
    this.app = app;
  }

  view(name, data = {}) {
    return this.app.make('view.helper')(name, data);
  }

  viewFor(request, name, data = {}) {
    const session = request.attribute('_session');
    const csrf = session ? this.app.make('session').get(session, '_csrf', '') : '';
    const user = request.attribute('_user');
    const flashOld = session ? this.app.make('session').get(session, '_flash.old', {}) : {};

    return this.view(name, {
      ...data,
      _csrf: csrf,
      auth: user,
      _old: flashOld?.old ?? {},
      _errors: flashOld?.errors ?? {},
    });
  }

  redirect(url, status = 302) {
    return Redirect.to(url, status);
  }

  asset(path) {
    return this.app.make('assets').url(path);
  }

  storage(path) {
    return this.app.make('assets').storageUrl(path);
  }

  async upload(request, field, options = {}) {
    return this.app.make('uploader').fromRequest(request, field, options);
  }

  db() {
    return this.app.make('db');
  }

  auth(request) {
    return this.app.make('auth').forRequest(request);
  }

  user(request) {
    return request.attribute('_user');
  }

  async authorize(request, ability, ...args) {
    const user = this.user(request);
    await this.app.make('gate').authorize(ability, user, ...args);
    return true;
  }

  async can(request, ability, ...args) {
    const user = this.user(request);
    return this.app.make('gate').allows(ability, user, ...args);
  }

  async validate(request, rules, messages = {}, attributes = {}) {
    return this.app.make('validator').validateRequest(request, rules, messages, attributes);
  }

  async paginate(delegate, options = {}) {
    return this.app.make('paginator').paginate(delegate, options);
  }

  log(channel = null) {
    return channel ? this.app.make('log').channel(channel) : this.app.make('log');
  }

  event(nameOrObject, payload) {
    return this.app.make('events').dispatch(nameOrObject, payload);
  }

  cache(store = null) {
    return store ? this.app.make('cache').store(store) : this.app.make('cache');
  }

  mail(mailer = null) {
    const manager = this.app.make('mail');
    return mailer ? manager.mailer(mailer) : manager;
  }

  queue(connection = null) {
    const manager = this.app.make('queue');
    return connection ? manager.connection(connection) : manager;
  }
}
