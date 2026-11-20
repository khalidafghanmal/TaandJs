import test from 'node:test';
import assert from 'node:assert/strict';
import { Hasher } from '../engine/auth/Hasher.js';
import { Gate } from '../engine/auth/Gate.js';
import { Config } from '../engine/core/Config.js';
import { Container } from '../engine/core/Container.js';
import { miniApp } from './helpers/setup.js';

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

test('hasher verify rejects hashes with an empty or truncated key', async () => {
  for (const stored of ['$scrypt$c2FsdHNhbHRzYWx0c2FsdA==$', '$scrypt$c2FsdHNhbHRzYWx0c2FsdA==$AA==', '$scrypt$$']) {
    assert.equal(await hasher.verify('any-password', stored), false, stored);
  }
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

test('gate does not resolve abilities to Object.prototype members', async () => {
  const { gate } = miniApp();
  class Post {}
  class PostPolicy {
    update(user, post) {
      return user.id === post.userId;
    }
  }
  gate.policy('Post', PostPolicy);

  const user = { id: 1, role: 'user' };
  const post = Object.assign(new Post(), { userId: 2 });
  for (const ability of ['toString', 'valueOf', 'toLocaleString', 'constructor', '__proto__']) {
    assert.equal(await gate.allows(ability, user, post), false, ability);
  }
  assert.equal(await gate.allows('update', { id: 2, role: 'user' }, post), true);

  assert.equal(await gate.allows('content.view', { role: '__proto__' }), false);
  assert.equal(await gate.allows('content.view', { role: 'constructor' }), false);
});
