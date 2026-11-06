import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

import { PersonalAccessTokenManager } from '../engine/auth/PersonalAccessTokenManager.js';
import { AuthManager } from '../engine/auth/AuthManager.js';
import { Hasher } from '../engine/auth/Hasher.js';
import { Config } from '../engine/core/Config.js';
import { Container } from '../engine/core/Container.js';
import { SessionStore } from '../engine/auth/SessionStore.js';
import { UserProvider } from '../engine/auth/UserProvider.js';
import { req } from './helpers/setup.js';

function hashSecret(secret) {
  return crypto.createHash('sha256').update(String(secret)).digest('hex');
}

function mockTokenDb() {
  const rows = new Map();
  let nextId = 1;

  return {
    rows,
    db: {
      personalAccessToken: {
        async create({ data }) {
          const record = {
            id: nextId++,
            ...data,
            lastUsedAt: null,
            createdAt: new Date(),
          };
          rows.set(record.id, record);
          return { ...record };
        },
        async findUnique({ where: { id }, include }) {
          const record = rows.get(id);
          if (!record) return null;
          const out = { ...record };
          if (include?.user) {
            out.user = {
              id: record.userId,
              name: 'Test User',
              email: 'test@example.com',
              role: 'admin',
            };
          }
          return out;
        },
        async update({ where: { id }, data }) {
          const record = rows.get(id);
          if (!record) throw new Error('not found');
          Object.assign(record, data);
          return { ...record };
        },
        async delete({ where }) {
          if (where.userId != null && rows.get(where.id)?.userId !== where.userId) {
            throw new Error('not found');
          }
          rows.delete(where.id);
        },
        async deleteMany({ where: { userId } }) {
          let count = 0;
          for (const [id, row] of rows) {
            if (row.userId === userId) {
              rows.delete(id);
              count++;
            }
          }
          return { count };
        },
        async findMany({ where: { userId }, orderBy, select }) {
          return [...rows.values()]
            .filter((row) => row.userId === userId)
            .sort((a, b) => b.createdAt - a.createdAt)
            .map((row) => {
              const picked = {};
              for (const key of Object.keys(select)) {
                picked[key] = row[key];
              }
              return picked;
            });
        },
      },
    },
  };
}

function tokenApp(db, authConfig = {}) {
  const app = Object.assign(new Container(), { basePath: process.cwd(), debug: false });
  const config = new Config();
  config.merge({
    auth: {
      tokens: {
        prefix: '',
        expirationDays: null,
        fallback: 'machine-secret',
        machineAbilities: ['*'],
      },
      session: { rememberDays: 14 },
      remember: { cookie: 'taand_remember' },
      ...authConfig,
    },
    app: { key: 'test-key', apiToken: 'machine-secret', env: 'local', allowMachineToken: true },
  });

  const hasher = new Hasher({ N: 1024, r: 8, p: 1, keyLength: 32 });
  const tokens = new PersonalAccessTokenManager(app);
  const users = new UserProvider(app);
  const sessions = { get: () => null, put: () => {}, forget: () => {}, regenerate: () => {} };

  app.make = (name) => {
    if (name === 'config') return config;
    if (name === 'db') return db;
    if (name === 'hasher') return hasher;
    if (name === 'users') return users;
    if (name === 'session') return sessions;
    if (name === 'tokens') return tokens;
    if (name === 'auth') return new AuthManager(app);
    throw new Error(`Unknown binding: ${name}`);
  };
  app.has = (name) => ['config', 'db', 'hasher', 'users', 'session', 'tokens', 'auth'].includes(name);

  return { app, tokens, config };
}

test('PersonalAccessTokenManager creates id|secret token and stores hash only', async () => {
  const { db, rows } = mockTokenDb();
  const { tokens } = tokenApp(db);

  const created = await tokens.create(1, 'mobile', ['profile.edit']);

  assert.match(created.plainTextToken, /^\d+\|/);
  assert.deepEqual(created.abilities, ['profile.edit']);

  const stored = rows.get(created.id);
  assert.notEqual(stored.token, created.plainTextToken);
  assert.equal(stored.token, hashSecret(created.plainTextToken.split('|')[1]));
});

test('PersonalAccessTokenManager resolves user from valid credential', async () => {
  const { db } = mockTokenDb();
  const { tokens } = tokenApp(db);

  const created = await tokens.create(1, 'api');
  const match = await tokens.findUserByCredential(created.plainTextToken);

  assert.equal(match.user.email, 'test@example.com');
  assert.equal(match.token.name, 'api');
  assert.deepEqual(match.token.abilities, ['*']);
});

test('PersonalAccessTokenManager rejects wrong secret', async () => {
  const { db } = mockTokenDb();
  const { tokens } = tokenApp(db);

  const created = await tokens.create(1, 'api');
  const match = await tokens.findUserByCredential(`${created.id}|wrong-secret`);

  assert.equal(match, null);
});

test('PersonalAccessTokenManager rejects expired token', async () => {
  const { db } = mockTokenDb();
  const { tokens } = tokenApp(db);

  const created = await tokens.create(1, 'api', ['*'], new Date(Date.now() - 1000));
  const match = await tokens.findUserByCredential(created.plainTextToken);

  assert.equal(match, null);
});

test('PersonalAccessTokenManager revoke and list', async () => {
  const { db } = mockTokenDb();
  const { tokens } = tokenApp(db);

  const first = await tokens.create(1, 'one');
  await tokens.create(1, 'two');

  const listed = await tokens.listForUser(1);
  assert.equal(listed.length, 2);

  assert.equal(await tokens.revoke(first.id, 1), true);
  assert.equal(await tokens.revoke(first.id, 1), false);
  assert.equal((await tokens.listForUser(1)).length, 1);
  assert.equal(await tokens.revokeAll(1), 1);
});

test('auth api guard loads real user from personal access token', async () => {
  const { db } = mockTokenDb();
  const { app, tokens } = tokenApp(db);

  const created = await tokens.create(1, 'cli');
  const request = req('/api/me', {
    headers: { authorization: `Bearer ${created.plainTextToken}` },
  });

  const auth = app.make('auth').forRequest(request).guard('api');
  const user = await auth.loadUser();

  assert.equal(user.id, 1);
  assert.equal(user.role, 'admin');
  assert.equal(user.guard, 'api');
  assert.equal(auth.accessToken().name, 'cli');
});

test('auth api guard falls back to machine token without user id', async () => {
  const { db } = mockTokenDb();
  const { app } = tokenApp(db);

  const request = req('/api/health', {
    headers: { authorization: 'Bearer machine-secret' },
  });

  const auth = app.make('auth').forRequest(request).guard('api');
  const user = await auth.loadUser();

  assert.equal(user.machine, true);
  assert.equal(user.guard, 'api');
  assert.equal(user.id, undefined);
  assert.equal(auth.accessToken().name, 'machine');
  assert.deepEqual(auth.accessToken().abilities, ['*']);
});

test('auth createToken requires authenticated session user', async () => {
  const { db } = mockTokenDb();
  const { app } = tokenApp(db);

  const request = req('/tokens');
  request.setAttribute('_user', { id: 2, name: 'A', email: 'a@x.com', role: 'user', guard: 'session' });

  const auth = app.make('auth').forRequest(request);
  const created = await auth.createToken('desktop', ['profile.edit']);

  assert.match(created.plainTextToken, /^\d+\|/);
  assert.deepEqual(created.abilities, ['profile.edit']);
});

test('tokenCan respects token abilities', async () => {
  const { db } = mockTokenDb();
  const { tokens } = tokenApp(db);

  assert.equal(tokens.tokenCan({ abilities: ['profile.edit'] }, 'profile.edit'), true);
  assert.equal(tokens.tokenCan({ abilities: ['profile.edit'] }, 'content.manage'), false);
  assert.equal(tokens.tokenCan({ abilities: ['*'] }, 'anything'), true);
});

test('token created with an empty ability list grants nothing', async () => {
  const { db, rows } = mockTokenDb();
  const { tokens } = tokenApp(db);

  const created = await tokens.create(1, 'read-nothing', []);
  assert.deepEqual(created.abilities, []);
  assert.equal(rows.get(created.id).abilities, '[]');

  const match = await tokens.findUserByCredential(created.plainTextToken);
  assert.deepEqual(match.token.abilities, []);
  assert.equal(tokens.tokenCan(match.token, 'profile.edit'), false);

  const [listed] = await tokens.listForUser(1);
  assert.deepEqual(listed.abilities, []);
});

test('stored empty or null abilities fail closed', async () => {
  const { db, rows } = mockTokenDb();
  const { tokens } = tokenApp(db);

  for (const stored of ['[]', '', null]) {
    const created = await tokens.create(1, 'legacy', ['profile.edit']);
    rows.get(created.id).abilities = stored;
    const match = await tokens.findUserByCredential(created.plainTextToken);
    assert.equal(tokens.tokenCan(match.token, 'anything'), false, `stored=${JSON.stringify(stored)}`);
  }
});

test('token abilities default to * only when omitted', async () => {
  const { db } = mockTokenDb();
  const { tokens } = tokenApp(db);

  assert.deepEqual((await tokens.create(1, 'omitted')).abilities, ['*']);
  assert.deepEqual((await tokens.create(1, 'explicit-undefined', undefined)).abilities, ['*']);
  assert.deepEqual((await tokens.create(1, 'null', null)).abilities, []);
});

test('machine token with an empty ability list grants nothing', async () => {
  const { db } = mockTokenDb();
  const { app } = tokenApp(db, {
    tokens: { fallback: 'machine-secret', machineAbilities: [] },
  });

  const request = req('/api/health', {
    headers: { authorization: 'Bearer machine-secret' },
  });

  const auth = app.make('auth').forRequest(request).guard('api');
  await auth.loadUser();

  assert.deepEqual(auth.accessToken().abilities, []);
  assert.equal(auth.tokenCan('anything'), false);
});
