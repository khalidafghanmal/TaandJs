import crypto from 'node:crypto';
import { secureCompare } from '../support/secureCompare.js';

/**
 * Request-scoped authentication — login, logout, guards, remember-me.
 */
export class AuthManager {
  constructor(app) {
    this.app = app;
    this.#hasher = app.make('hasher');
    this.#users = app.make('users');
    this.#sessions = app.make('session');
    this.#tokens = app.has('tokens') ? app.make('tokens') : null;
    this.#config = () => app.make('config').get('auth', {});
  }

  #hasher;
  #users;
  #sessions;
  #tokens;
  #config;

  forRequest(request) {
    return new RequestAuth(
      this.app,
      request,
      this.#hasher,
      this.#users,
      this.#sessions,
      this.#tokens,
      this.#config,
    );
  }
}

class RequestAuth {
  constructor(app, request, hasher, users, sessions, tokens, configFn) {
    this.app = app;
    this.request = request;
    this.#hasher = hasher;
    this.#users = users;
    this.#sessions = sessions;
    this.#tokens = tokens;
    this.#config = configFn;
    this.#guard = 'session';
    this.#user = request.attribute('_user') ?? null;
    this.#accessToken = request.attribute('_access_token') ?? null;
  }

  #hasher;
  #users;
  #sessions;
  #tokens;
  #config;
  #guard;
  #user;
  #accessToken;

  guard(name) {
    this.#guard = name;
    return this;
  }

  user() {
    return this.#user;
  }

  id() {
    return this.#user?.id ?? null;
  }

  check() {
    return this.#user !== null;
  }

  guest() {
    return !this.check();
  }

  accessToken() {
    return this.#accessToken;
  }

  tokenCan(ability) {
    if (!this.#accessToken) return false;
    return this.#tokens?.tokenCan(this.#accessToken, ability) ?? false;
  }

  async createToken(name, abilities = ['*'], expiresInDays = null) {
    if (!this.#tokens) {
      throw new Error('[Taand] Personal access tokens are not registered');
    }

    const userId = this.id();
    if (!userId) {
      throw new Error('[Taand] createToken() requires an authenticated user');
    }

    const config = this.#config().tokens ?? {};
    const days = expiresInDays ?? config.expirationDays ?? null;
    let expiresAt = null;
    if (days && Number(days) > 0) {
      expiresAt = new Date(Date.now() + Number(days) * 24 * 60 * 60 * 1000);
    }

    return this.#tokens.create(userId, name, abilities, expiresAt);
  }

  async tokens() {
    if (!this.#tokens || !this.id()) return [];
    return this.#tokens.listForUser(this.id());
  }

  async revokeToken(tokenId) {
    if (!this.#tokens || !this.id()) return false;
    return this.#tokens.revoke(tokenId, this.id());
  }

  async revokeAllTokens() {
    if (!this.#tokens || !this.id()) return 0;
    return this.#tokens.revokeAll(this.id());
  }

  async attempt(credentials, remember = false) {
    const email = credentials.email?.trim().toLowerCase();
    const password = credentials.password ?? '';

    if (!email || !password) return false;

    const record = await this.#users.findByEmail(email);
    if (!record) {
      await this.#hasher.verify(password, '$scrypt$AAAAAAAAAAAAAAAAAAAAAA==$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=');
      return false;
    }

    const valid = await this.#hasher.verify(password, record.passwordHash);
    if (!valid) return false;

    await this.login(this.#publicUser(record), remember);
    return true;
  }

  async login(user, remember = false) {
    const session = this.#session();
    this.#sessions.regenerate(session);
    this.#sessions.put(session, '_user_id', user.id);
    this.#user = user;
    this.request.setAttribute('_user', user);

    if (remember) {
      await this.#attachRemember(user);
    }

    return user;
  }

  async logout() {
    const session = this.#session();
    const userId = this.#sessions.get(session, '_user_id');

    if (userId) {
      await this.#users.updateRememberToken(userId, null);
    }

    this.#sessions.forget(session, '_user_id');
    this.#user = null;
    this.request.setAttribute('_user', null);
    this.#clearRememberCookie();
    return true;
  }

  async loadUser() {
    if (this.#user) return this.#user;

    if (this.#guard === 'api') {
      return this.#loadApiUser();
    }

    const session = this.#session();
    const userId = this.#sessions.get(session, '_user_id');

    if (userId) {
      const user = await this.#users.findById(userId);
      if (user) {
        this.#user = this.#publicUser(user);
        this.request.setAttribute('_user', this.#user);
        return this.#user;
      }

      this.#sessions.forget(session, '_user_id');
    }

    return this.#loadRememberUser();
  }

  async authenticateFromRemember() {
    if (this.check()) return this.#user;
    // Already logged in via the session — re-logging in would regenerate the id and CSRF token.
    if (this.#sessions.get(this.#session(), '_user_id')) return null;
    return this.#loadRememberUser();
  }

  flash(key, fallback = null) {
    const session = this.#session();
    const old = this.#sessions.get(session, '_flash.old', {});
    const current = this.#sessions.get(session, key);
    if (key in old) return old[key];
    if (current !== null) return current;
    return fallback;
  }

  #session() {
    const session = this.request.attribute('_session');
    if (!session) {
      throw new Error('[Taand] Session not started — add startSession to web middleware group');
    }
    return session;
  }

  async #loadApiUser() {
    const header = this.request.header('authorization') ?? '';
    const bearer = header.startsWith('Bearer ') ? header.slice(7).trim() : null;
    const apiKey = this.request.header('x-api-key');
    const provided = bearer ?? apiKey;

    if (!provided) return null;

    if (this.#tokens) {
      const match = await this.#tokens.findUserByCredential(provided);
      if (match?.user) {
        this.#user = this.#publicUser(match.user);
        this.#accessToken = match.token;
        this.request.setAttribute('_user', this.#user);
        this.request.setAttribute('_access_token', match.token);
        return this.#user;
      }
    }

    const config = this.#config().tokens ?? {};
    const appConfig = this.app.make('config').get('app', {});
    const configured =
      config.fallback
      || appConfig.apiToken
      || '';

    if (appConfig.env === 'production' && !appConfig.allowMachineToken) {
      return null;
    }

    if (!configured || !secureCompare(provided, configured)) {
      return null;
    }

    const abilities = config.machineAbilities?.length ? config.machineAbilities : ['*'];
    this.#accessToken = { name: 'machine', abilities, machine: true };
    this.#user = { guard: 'api', machine: true, token: 'machine' };
    this.request.setAttribute('_user', this.#user);
    this.request.setAttribute('_access_token', this.#accessToken);
    return this.#user;
  }

  async #loadRememberUser() {
    const config = this.#config().remember ?? {};
    const cookieName = config.cookie ?? 'taand_remember';
    const raw = this.request.cookies()[cookieName];
    if (!raw) return null;

    const parsed = this.#parseRememberCookie(raw);
    if (!parsed) return null;

    const record = await this.#users.findById(parsed.userId);
    if (!record?.rememberToken) {
      return null;
    }

    const valid = await this.#hasher.verify(parsed.token, record.rememberToken);
    if (!valid) {
      return null;
    }

    // Rotate on every use: a stolen cookie and the real one cannot both keep working.
    const user = this.#publicUser(record);
    await this.login(user, true);
    return user;
  }

  async #attachRemember(user) {
    const { token, hash } = await this.#hasher.hashToken();
    await this.#users.updateRememberToken(user.id, hash);

    const days = this.#config().session?.rememberDays ?? 14;
    const config = this.#config().remember ?? {};
    const cookieName = config.cookie ?? 'taand_remember';
    const maxAge = days * 24 * 60 * 60;
    const payload = this.#signRemember({ userId: user.id, token, exp: Date.now() + maxAge * 1000 });

    const parts = [
      `${cookieName}=${payload}`,
      'Path=/',
      'HttpOnly',
      'SameSite=Lax',
      `Max-Age=${maxAge}`,
    ];

    const secure = this.#config().session?.secure ?? false;
    if (secure) parts.push('Secure');

    this.request.setAttribute('_remember_cookie', parts.join('; '));
  }

  #clearRememberCookie() {
    const config = this.#config().remember ?? {};
    const cookieName = config.cookie ?? 'taand_remember';
    this.request.setAttribute('_remember_cookie', `${cookieName}=; Path=/; HttpOnly; Max-Age=0; SameSite=Lax`);
  }

  #parseRememberCookie(raw) {
    const dot = raw.lastIndexOf('.');
    if (dot === -1) return null;

    const encoded = raw.slice(0, dot);
    const sig = raw.slice(dot + 1);
    const key = this.app.make('config').get('app.key', '');

    const expected = crypto.createHmac('sha256', key).update(encoded).digest('base64url');
    try {
      if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) {
        return null;
      }
    } catch {
      return null;
    }

    try {
      const json = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
      if (!json?.userId || !json?.token) return null;
      // Expiry is signed, so it holds even if the client keeps the cookie past Max-Age.
      if (!(Number(json.exp) > Date.now())) return null;
      return { userId: Number(json.userId), token: String(json.token) };
    } catch {
      return null;
    }
  }

  #signRemember(data) {
    const encoded = Buffer.from(JSON.stringify(data)).toString('base64url');
    const key = this.app.make('config').get('app.key', '');
    const sig = crypto.createHmac('sha256', key).update(encoded).digest('base64url');
    return `${encoded}.${sig}`;
  }

  #publicUser(record) {
    return {
      id: record.id,
      name: record.name,
      email: record.email,
      role: record.role,
      guard: this.#guard,
    };
  }
}
