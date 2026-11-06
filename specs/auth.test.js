import test from 'node:test';
import assert from 'node:assert/strict';
import { Hasher } from '../engine/auth/Hasher.js';
import { Gate } from '../engine/auth/Gate.js';
import { Config } from '../engine/core/Config.js';
import { Container } from '../engine/core/Container.js';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
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

function sessionStoreFor(session = {}) {
  const basePath = fs.mkdtempSync(path.join(os.tmpdir(), 'taand-sess-'));
  const app = Object.assign(new Container(), { basePath, debug: false });
  const config = new Config();
  config.merge({ app: { key: 'test-key' }, auth: { session: { path: 'sessions', ...session } } });
  app.make = (name) => (name === 'config' ? config : null);
  return {
    store: new SessionStore(app),
    dir: path.join(basePath, 'sessions'),
    cleanup: () => fs.rmSync(basePath, { recursive: true, force: true }),
  };
}

async function countDirScans(fn) {
  const original = fs.readdirSync;
  let scans = 0;
  fs.readdirSync = (...args) => {
    scans++;
    return original(...args);
  };
  try {
    await fn();
  } finally {
    fs.readdirSync = original;
  }
  return scans;
}

test('session store does not scan the whole session directory on every request', async () => {
  const { store, cleanup } = sessionStoreFor();
  try {
    const scans = await countDirScans(() => {
      for (let i = 0; i < 200; i++) {
        const session = store.load(req('/'));
        store.put(session, '_csrf', 'x');
        store.commit(session, Response.text('ok'));
      }
    });
    assert.ok(scans < 50, `expected occasional GC, got ${scans} scans for 200 requests`);
  } finally {
    cleanup();
  }
});

test('session gc lottery is configurable and still removes expired sessions', async () => {
  const never = sessionStoreFor({ lottery: [0, 100] });
  try {
    const scans = await countDirScans(() => {
      for (let i = 0; i < 20; i++) never.store.commit(never.store.load(req('/')), Response.text('ok'));
    });
    assert.equal(scans, 0);
  } finally {
    never.cleanup();
  }

  const always = sessionStoreFor({ lottery: [1, 1], lifetime: 1 });
  try {
    const stale = path.join(always.dir, `sess_${'a'.repeat(40)}`);
    fs.writeFileSync(stale, '{}');
    const old = new Date(Date.now() - 5 * 60_000);
    fs.utimesSync(stale, old, old);

    always.store.commit(always.store.load(req('/')), Response.text('ok'));
    assert.equal(fs.existsSync(stale), false);
  } finally {
    always.cleanup();
  }
});
