import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { Hasher } from '../engine/auth/Hasher.js';
import { AuthManager } from '../engine/auth/AuthManager.js';
import { Gate } from '../engine/auth/Gate.js';
import { Config } from '../engine/core/Config.js';
import { Container } from '../engine/core/Container.js';
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

function rememberApp() {
  const app = Object.assign(new Container(), { basePath: process.cwd(), debug: false });
  const config = new Config();
  config.merge({
    app: { key: 'test-key' },
    auth: { session: { rememberDays: 14 }, remember: { cookie: 'taand_remember' } },
  });
  const users = {
    rememberToken: null,
    async updateRememberToken(_id, hash) { this.rememberToken = hash; },
    async findById(id) {
      return { id, name: 'A', email: 'a@x.com', role: 'user', rememberToken: this.rememberToken };
    },
  };
  const sessions = {
    get: (s, key) => s[key] ?? null,
    put: (s, key, value) => { s[key] = value; },
    forget: (s, key) => { delete s[key]; },
    regenerate: () => {},
  };
  app.make = (name) => ({ config, hasher, users, session: sessions })[name];
  app.has = () => false;
  return { auth: new AuthManager(app), users };
}

function rememberRequest(cookie = '') {
  const request = req('/', { headers: cookie ? { cookie } : {} });
  request.setAttribute('_session', {});
  return request;
}

const rememberValue = (request) => request.attribute('_remember_cookie').split(';')[0];

test('remember-me login rotates the token so a replayed cookie stops working', async () => {
  const { auth } = rememberApp();
  const login = rememberRequest();
  await auth.forRequest(login).login({ id: 5, role: 'user' }, true);
  const first = rememberValue(login);

  const visit = rememberRequest(first);
  assert.equal((await auth.forRequest(visit).authenticateFromRemember())?.id, 5);
  const second = rememberValue(visit);
  assert.notEqual(second, first);

  assert.equal(await auth.forRequest(rememberRequest(first)).authenticateFromRemember(), null);
  assert.equal((await auth.forRequest(rememberRequest(second)).authenticateFromRemember())?.id, 5);
});

test('remember-me cookie expires server-side after rememberDays', async () => {
  const { auth } = rememberApp();
  const login = rememberRequest();
  await auth.forRequest(login).login({ id: 5, role: 'user' }, true);
  const cookie = rememberValue(login);

  const realNow = Date.now;
  Date.now = () => realNow() + 15 * 24 * 60 * 60 * 1000;
  try {
    assert.equal(await auth.forRequest(rememberRequest(cookie)).authenticateFromRemember(), null);
  } finally {
    Date.now = realNow;
  }
});

test('remember-me cookie without an expiry is rejected', async () => {
  const { auth, users } = rememberApp();
  const { token, hash } = await hasher.hashToken();
  users.rememberToken = hash;
  const encoded = Buffer.from(JSON.stringify({ userId: 5, token })).toString('base64url');
  const sig = crypto.createHmac('sha256', 'test-key').update(encoded).digest('base64url');

  const request = rememberRequest(`taand_remember=${encoded}.${sig}`);
  assert.equal(await auth.forRequest(request).authenticateFromRemember(), null);
});

test('logout invalidates the stored remember-me token', async () => {
  const { auth, users } = rememberApp();
  const login = rememberRequest();
  await auth.forRequest(login).login({ id: 5, role: 'user' }, true);
  const cookie = rememberValue(login);

  const out = rememberRequest(cookie);
  out.attribute('_session')._user_id = 5;
  await auth.forRequest(out).logout();

  assert.equal(users.rememberToken, null);
  assert.equal(await auth.forRequest(rememberRequest(cookie)).authenticateFromRemember(), null);
});

test('remember-me cookie is not rotated while the session is logged in', async () => {
  const { auth } = rememberApp();
  const login = rememberRequest();
  await auth.forRequest(login).login({ id: 5, role: 'user' }, true);

  const visit = rememberRequest(rememberValue(login));
  visit.attribute('_session')._user_id = 5;
  await auth.forRequest(visit).authenticateFromRemember();

  assert.equal(visit.attribute('_remember_cookie'), null);
});
