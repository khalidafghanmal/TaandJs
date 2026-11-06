import test from 'node:test';
import assert from 'node:assert/strict';
import { Hasher } from '../engine/auth/Hasher.js';
import { Gate } from '../engine/auth/Gate.js';
import { Config } from '../engine/core/Config.js';
import { Container } from '../engine/core/Container.js';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { AuthManager } from '../engine/auth/AuthManager.js';
import { SessionStore } from '../engine/auth/SessionStore.js';
import { Response } from '../engine/http/Response.js';
import { miniApp, req } from './helpers/setup.js';

const hasher = new Hasher({ N: 1024, r: 8, p: 1, keyLength: 32 });

test('hasher produces scrypt format', async () => {
  const hash = await hasher.hash('secret');
  assert.match(hash, /^\$scrypt\$/);
});

test('hasher verify accepts correct password', async () => {
  const hash = await hasher.hash('secret');
  assert.equal(await hasher.verify('secret', hash), true);
});

test('hasher verify rejects wrong password', async () => {
  const hash = await hasher.hash('secret');
  assert.equal(await hasher.verify('wrong', hash), false);
});

test('hasher verify rejects empty password', async () => {
  assert.equal(await hasher.verify('', '$scrypt$x'), false);
});

test('hasher verify rejects malformed hash', async () => {
  assert.equal(await hasher.verify('secret', 'not-a-hash'), false);
});

test('hasher hash rejects empty string', async () => {
  await assert.rejects(() => hasher.hash(''), /non-empty string/);
});

test('hasher hashToken returns token and hash', async () => {
  const { token, hash } = await hasher.hashToken();
  assert.equal(token.length, 64);
  assert.match(hash, /^\$scrypt\$/);
});

test('gate admin ability', async () => {
  const { gate } = miniApp();
  assert.equal(await gate.allows('admin', { role: 'admin' }), true);
  assert.equal(await gate.allows('admin', { role: 'user' }), false);
});

test('gate editor ability', async () => {
  const { gate } = miniApp();
  assert.equal(await gate.allows('editor', { role: 'editor' }), true);
  assert.equal(await gate.allows('editor', { role: 'user' }), false);
});

test('gate role permissions wildcard', async () => {
  const { gate } = miniApp();
  assert.equal(await gate.allows('content.manage', { role: 'admin' }), true);
});

test('gate role permissions specific', async () => {
  const { gate } = miniApp();
  assert.equal(await gate.allows('content.manage', { role: 'editor' }), true);
  assert.equal(await gate.allows('content.manage', { role: 'user' }), false);
});

test('gate denies without user', async () => {
  const { gate } = miniApp();
  assert.equal(await gate.allows('admin', null), false);
});

test('gate authorize throws 403', async () => {
  const { gate } = miniApp();
  await assert.rejects(() => gate.authorize('admin', { role: 'user' }), (err) => {
    assert.equal(err.status, 403);
    return true;
  });
});

test('gate custom ability via define', async () => {
  const { gate } = miniApp();
  gate.define('beta', (user) => user.beta === true);
  assert.equal(await gate.allows('beta', { beta: true }), true);
  assert.equal(await gate.allows('beta', { beta: false }), false);
});

test('gate denies helper', async () => {
  const { gate } = miniApp();
  assert.equal(await gate.denies('admin', { role: 'user' }), true);
});

test('gate manage-users default', async () => {
  const { gate } = miniApp();
  assert.equal(await gate.allows('manage-users', { role: 'admin' }), true);
  assert.equal(await gate.allows('manage-users', { role: 'editor' }), false);
});

test('gate view-admin uses hierarchy', async () => {
  const app = Object.assign(new Container(), { debug: false });
  const config = new Config();
  config.set('auth', {
    roles: { hierarchy: { admin: 100, user: 10 }, permissions: {} },
  });
  app.make = (n) => (n === 'config' ? config : null);
  const gate = new Gate(app);
  assert.equal(await gate.allows('view-admin', { role: 'admin' }), true);
  assert.equal(await gate.allows('view-admin', { role: 'user' }), false);
});

function sessionAuthApp() {
  const basePath = fs.mkdtempSync(path.join(os.tmpdir(), 'taand-auth-'));
  const app = Object.assign(new Container(), { basePath, debug: false });
  const config = new Config();
  config.merge({
    app: { key: 'test-key' },
    auth: { session: { path: 'sessions' }, remember: { cookie: 'taand_remember' } },
  });
  const users = {
    remember: null,
    async updateRememberToken(_id, hash) { this.remember = hash; },
    async findById(id) {
      return { id, name: 'A', email: 'a@x.com', role: 'user', rememberToken: this.remember };
    },
  };

  app.make = (name) => {
    if (name === 'config') return config;
    if (name === 'hasher') return hasher;
    if (name === 'users') return users;
    if (name === 'session') return sessions;
    throw new Error(`Unknown binding: ${name}`);
  };
  app.has = () => false;
  const sessions = new SessionStore(app);

  return {
    sessions,
    auth: new AuthManager(app),
    cleanup: () => fs.rmSync(basePath, { recursive: true, force: true }),
  };
}

function cookieFrom(response, name) {
  const cookie = response.headers['Set-Cookie'].find((c) => c.startsWith(`${name}=`));
  return cookie.split(';')[0];
}

test('logout destroys the session and rotates the csrf token', async () => {
  const { sessions, auth, cleanup } = sessionAuthApp();
  try {
    const first = req('/login', { method: 'POST' });
    const session = sessions.load(first);
    sessions.put(session, '_csrf', 'csrf-before-logout');
    first.setAttribute('_session', session);
    await auth.forRequest(first).login({ id: 7, name: 'A', email: 'a@x.com', role: 'user' });
    sessions.put(session, 'cart', ['secret-item']);
    const loginResponse = Response.text('ok');
    sessions.commit(session, loginResponse);
    const loggedInId = session.id;

    const second = req('/logout', {
      method: 'POST',
      headers: { cookie: cookieFrom(loginResponse, 'taand_session') },
    });
    const loaded = sessions.load(second);
    assert.equal(loaded.id, loggedInId);
    second.setAttribute('_session', loaded);
    await auth.forRequest(second).logout();
    sessions.commit(loaded, Response.text('bye'));

    assert.notEqual(loaded.id, loggedInId);
    assert.equal(sessions.get(loaded, '_user_id'), null);
    assert.equal(sessions.get(loaded, 'cart'), null);
    assert.notEqual(sessions.get(loaded, '_csrf'), 'csrf-before-logout');
    assert.ok(sessions.get(loaded, '_csrf'));

    // The pre-logout session id must no longer resolve to stored data.
    const replay = req('/dashboard', { headers: { cookie: cookieFrom(loginResponse, 'taand_session') } });
    const replayed = sessions.load(replay);
    assert.equal(replayed.isNew, true);
    assert.equal(sessions.get(replayed, '_user_id'), null);
  } finally {
    cleanup();
  }
});

test('login rotates the csrf token along with the session id', async () => {
  const { sessions, auth, cleanup } = sessionAuthApp();
  try {
    const request = req('/login', { method: 'POST' });
    const session = sessions.load(request);
    sessions.put(session, '_csrf', 'attacker-planted-token');
    request.setAttribute('_session', session);

    await auth.forRequest(request).login({ id: 7, name: 'A', email: 'a@x.com', role: 'user' });

    assert.equal(sessions.get(session, '_user_id'), 7);
    assert.notEqual(sessions.get(session, '_csrf'), 'attacker-planted-token');
    assert.ok(sessions.get(session, '_csrf'));
  } finally {
    cleanup();
  }
});

test('remember cookie does not re-login an already authenticated session', async () => {
  const { sessions, auth, cleanup } = sessionAuthApp();
  try {
    const first = req('/login', { method: 'POST' });
    const session = sessions.load(first);
    first.setAttribute('_session', session);
    await auth.forRequest(first).login({ id: 7, name: 'A', email: 'a@x.com', role: 'user' }, true);
    const response = Response.text('ok');
    sessions.commit(session, response);
    const remember = first.attribute('_remember_cookie').split(';')[0];

    const next = req('/form', {
      headers: { cookie: `${cookieFrom(response, 'taand_session')}; ${remember}` },
    });
    const loaded = sessions.load(next);
    const { id, data: { _csrf: csrf } } = loaded;
    next.setAttribute('_session', loaded);
    await auth.forRequest(next).authenticateFromRemember();

    assert.equal(loaded.id, id);
    assert.equal(sessions.get(loaded, '_csrf'), csrf);
  } finally {
    cleanup();
  }
});
