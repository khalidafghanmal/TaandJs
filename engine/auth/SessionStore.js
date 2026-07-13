import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { Response } from '../http/Response.js';

/**
 * File-based session store — Taand session file driver equivalent.
 */
export class SessionStore {
  constructor(app) {
    this.app = app;
    const config = app.make('config').get('auth.session', {});
    this.#path = path.join(app.basePath, config.path ?? 'storage/sessions');
    this.#lifetimeMs = (config.lifetime ?? 120) * 60_000;
    this.#cookie = config.cookie ?? 'taand_session';
    this.#secure = config.secure ?? false;
    this.#sameSite = config.sameSite ?? 'lax';
    this.#key = app.make('config').get('app.key', '');
    fs.mkdirSync(this.#path, { recursive: true });
  }

  #path;
  #lifetimeMs;
  #cookie;
  #secure;
  #sameSite;
  #key;

  cookieName() {
    return this.#cookie;
  }

  load(request) {
    const rawId = request.cookies()[this.#cookie];
    const id = this.#verifyId(rawId);

    if (id) {
      const data = this.#read(id);
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
      this.#destroy(session.id);
    }

    session.id = this.#generateId();
    session.isNew = true;
    session.dirty = true;
    return session;
  }

  commit(session, response) {
    this.#ageFlash(session);
    session.data._lastActivity = Date.now();

    if (session.dirty || session.isNew) {
      this.#write(session.id, session.data);
      session.isNew = false;
      session.dirty = false;
    }

    this.#setCookie(response, session.id);
    this.#gc();
    return response;
  }

  destroy(session, response) {
    this.#destroy(session.id);
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

  #filePath(id) {
    return path.join(this.#path, `sess_${id}`);
  }

  #read(id) {
    const file = this.#filePath(id);

    try {
      if (!fs.existsSync(file)) return null;

      const stat = fs.statSync(file);
      if (Date.now() - stat.mtimeMs > this.#lifetimeMs) {
        fs.unlinkSync(file);
        return null;
      }

      const payload = JSON.parse(fs.readFileSync(file, 'utf8'));
      return payload && typeof payload === 'object' ? payload : null;
    } catch {
      return null;
    }
  }

  #write(id, data) {
    const file = this.#filePath(id);
    const temp = `${file}.${process.pid}.tmp`;
    fs.writeFileSync(temp, JSON.stringify(data), { mode: 0o600 });
    fs.renameSync(temp, file);
  }

  #destroy(id) {
    try {
      fs.unlinkSync(this.#filePath(id));
    } catch {
      /* already gone */
    }
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

  #gc() {
    try {
      const cutoff = Date.now() - this.#lifetimeMs;

      for (const file of fs.readdirSync(this.#path)) {
        if (!file.startsWith('sess_')) continue;
        const full = path.join(this.#path, file);
        const stat = fs.statSync(full);
        if (stat.mtimeMs < cutoff) fs.unlinkSync(full);
      }
    } catch {
      /* best effort */
    }
  }

  #capitalize(value) {
    const lower = String(value).toLowerCase();
    if (lower === 'none') return 'None';
    if (lower === 'strict') return 'Strict';
    return 'Lax';
  }
}
