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

function legacyScryptHash(password) {
  const salt = crypto.randomBytes(16);
  const key = crypto.scryptSync(password, salt, 64, { N: 16384, r: 8, p: 1 });
  return `$scrypt$${salt.toString('base64')}$${key.toString('base64')}`;
}

test('hasher defaults meet OWASP scrypt parameters and records them in the hash', async () => {
  const strong = new Hasher();
  const hash = await strong.hash('secret');
  assert.match(hash, /^\$scrypt\$N=32768,r=8,p=3\$/);
  assert.equal(await strong.verify('secret', hash), true);
  assert.equal(await strong.verify('wrong', hash), false);
  assert.equal(strong.needsRehash(hash), false);
});

test('hasher verifies legacy hashes and flags them for rehash', async () => {
  const legacy = legacyScryptHash('secret');
  const strong = new Hasher({ N: 2048 });
  assert.equal(await strong.verify('secret', legacy), true);
  assert.equal(await strong.verify('wrong', legacy), false);
  assert.equal(strong.needsRehash(legacy), true);
  assert.equal(strong.needsRehash(await strong.hash('secret')), false);
  assert.equal(strong.needsRehash(await hasher.hash('secret')), true);
});

test('attempt upgrades a legacy password hash after a successful login', async () => {
  const app = Object.assign(new Container(), { basePath: process.cwd(), debug: false });
  const config = new Config();
  config.merge({ app: { key: 'test-key' }, auth: {} });
  const strong = new Hasher({ N: 2048 });
  const record = { id: 3, name: 'A', email: 'a@x.com', role: 'user', passwordHash: legacyScryptHash('secret') };
  const users = {
    async findByEmail() { return record; },
    async updatePassword(id, hash) {
      assert.equal(id, 3);
      record.passwordHash = hash;
    },
  };
  const sessions = { get: () => null, put: () => {}, forget: () => {}, regenerate: () => {} };
  app.make = (name) => ({ config, hasher: strong, users, session: sessions })[name];
  app.has = () => false;

  const request = req('/login', { method: 'POST' });
  request.setAttribute('_session', {});
  const ok = await new AuthManager(app).forRequest(request).attempt({ email: 'a@x.com', password: 'secret' });
  assert.equal(ok, true);

  assert.match(record.passwordHash, /^\$scrypt\$N=2048,r=8,p=3\$/);
  assert.equal(await strong.verify('secret', record.passwordHash), true);
});
