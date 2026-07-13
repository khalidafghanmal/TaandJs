import crypto from 'node:crypto';
import { Response } from '../http/Response.js';

/**
 * Redis session store — shared sessions for multi-server production.
 */
export class RedisSessionStore {
  constructor(app) {
    this.app = app;
    const config = app.make('config').get('auth.session', {});
    this.#lifetimeMs = (config.lifetime ?? 120) * 60_000;
    this.#lifetimeSec = Math.max(60, Math.floor(this.#lifetimeMs / 1000));
    this.#cookie = config.cookie ?? 'taand_session';
    this.#secure = config.secure ?? false;
    this.#sameSite = config.sameSite ?? 'lax';
    this.#key = app.make('config').get('app.key', '');
    this.#connection = config.connection ?? 'session';
  }

  #lifetimeMs;
  #lifetimeSec;
  #cookie;
  #secure;
  #sameSite;
  #key;
  #connection;

  cookieName() {
    return this.#cookie;
  }

  async load(request) {
    const rawId = request.cookies()[this.#cookie];
    const id = this.#verifyId(rawId);

    if (id) {
      const data = await this.#read(id);
      if (data) {
        return this.#wrap(id, data, false);
      }
    }

    return this.#wrap(this.#generateId(), {}, true);
  }

  read(session) {
    return session.data;
  }

  get(session, key, fallback = null) {
    return key in session.data ? session.data[key] : fallback;
  }

  put(session, key, value) {
    session.data[key] = value;
    session.dirty = true;
    return session;
  }

  forget(session, key) {
    delete session.data[key];
    session.dirty = true;
    return session;
  }

  pull(session, key, fallback = null) {
    const value = this.get(session, key, fallback);
    this.forget(session, key);
    return value;
  }

  flash(session, key, value) {
    const flashes = this.get(session, '_flash.new', {});
    flashes[key] = value;
    this.put(session, '_flash.new', flashes);
    return session;
  }

  regenerate(session) {
    if (!session.isNew) {
      this.#destroy(session.id).catch(() => {});
    }

    session.id = this.#generateId();
    session.isNew = true;
    session.dirty = true;
    return session;
  }

  async commit(session, response) {
    this.#ageFlash(session);
    session.data._lastActivity = Date.now();

    if (session.dirty || session.isNew) {
      await this.#write(session.id, session.data);
      session.isNew = false;
      session.dirty = false;
    }

    this.#setCookie(response, session.id);
    return response;
  }

  async destroy(session, response) {
    await this.#destroy(session.id);
    session.data = {};
    session.dirty = false;
    this.#clearCookie(response);
    return response;
  }

  #wrap(id, data, isNew) {
    return { id, data, isNew, dirty: false };
  }

  #generateId() {
    return crypto.randomBytes(20).toString('hex');
  }

  #sign(id) {
    const sig = crypto.createHmac('sha256', this.#key).update(id).digest('base64url');
    return `${id}.${sig}`;
  }

  #verifyId(raw) {
    if (!raw || typeof raw !== 'string') return null;

    const dot = raw.lastIndexOf('.');
    if (dot === -1) return null;

    const id = raw.slice(0, dot);
    const sig = raw.slice(dot + 1);

    if (!/^[a-f0-9]{40}$/.test(id)) return null;

    const expected = crypto.createHmac('sha256', this.#key).update(id).digest('base64url');
    try {
      if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) {
        return null;
      }
    } catch {
      return null;
    }

    return id;
  }

  #sessionKey(id) {
    const connections = this.app.make('config').get('redis.connections', {});
    const prefix = connections[this.#connection]?.prefix ?? 'Taand:session:';
    return `${prefix}${id}`;
  }

  async #read(id) {
    try {
      const raw = await this.app.make('redis').connection(this.#connection).get(this.#sessionKey(id));
      if (!raw) return null;
      const payload = JSON.parse(raw);
      return payload && typeof payload === 'object' ? payload : null;
    } catch {
      return null;
    }
  }

  async #write(id, data) {
    await this.app.make('redis').connection(this.#connection).setEx(
      this.#sessionKey(id),
      this.#lifetimeSec,
      JSON.stringify(data),
    );
  }

  async #destroy(id) {
    await this.app.make('redis').connection(this.#connection).del(this.#sessionKey(id));
  }

  #setCookie(response, id) {
    const value = this.#sign(id);
    const maxAge = Math.floor(this.#lifetimeMs / 1000);
    const parts = [
      `${this.#cookie}=${value}`,
      'Path=/',
      'HttpOnly',
      `SameSite=${this.#capitalize(this.#sameSite)}`,
      `Max-Age=${maxAge}`,
    ];

    if (this.#secure) parts.push('Secure');

    Response.appendCookie(response, parts.join('; '));
  }

  #clearCookie(response) {
    const parts = [
      `${this.#cookie}=`,
      'Path=/',
      'HttpOnly',
      'Max-Age=0',
      `SameSite=${this.#capitalize(this.#sameSite)}`,
    ];
    if (this.#secure) parts.push('Secure');

    Response.appendCookie(response, parts.join('; '));
  }

  #ageFlash(session) {
    const old = this.get(session, '_flash.old', {});
    const fresh = this.get(session, '_flash.new', {});
    this.put(session, '_flash.old', fresh);
    this.put(session, '_flash.new', {});

    for (const key of Object.keys(old)) {
      this.forget(session, key);
    }
  }

  #capitalize(value) {
    const lower = String(value).toLowerCase();
    if (lower === 'none') return 'None';
    if (lower === 'strict') return 'Strict';
    return 'Lax';
  }
}
