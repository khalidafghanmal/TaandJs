import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

import { TrustProxies } from '../engine/middleware/TrustProxies.js';
import { TokenAbilities } from '../engine/middleware/auth/TokenAbilities.js';
import { assertProductionEnv } from '../engine/core/ProductionEnvValidator.js';
import { assertDevDashboard } from '../engine/support/DevDashboardGuard.js';
import { secureCompare } from '../engine/support/secureCompare.js';
import { TaandCompiler } from '../engine/view/TaandCompiler.js';
import { Config } from '../engine/core/Config.js';
import { Container } from '../engine/core/Container.js';
import { Response } from '../engine/http/Response.js';
import { PersonalAccessTokenManager } from '../engine/auth/PersonalAccessTokenManager.js';
import { AuthManager } from '../engine/auth/AuthManager.js';
import { Hasher } from '../engine/auth/Hasher.js';
import { UserProvider } from '../engine/auth/UserProvider.js';
import { req, miniApp } from './helpers/setup.js';

function configWith(overrides = {}) {
  const config = new Config();
  const base = {
    app: {
      key: 'test-production-key-32chars-minimum',
      env: 'production',
      debug: false,
      apiToken: '',
      allowMachineToken: false,
      trustedProxies: [],
      devDashboardKey: '',
      ...(overrides.app ?? {}),
    },
    database: {
      url: 'postgresql://user:pass@db.example.com/taand',
      ...(overrides.database ?? {}),
    },
    auth: {
      tokens: {
        fallback: '',
        machineAbilities: ['*'],
        ...(overrides.auth?.tokens ?? {}),
      },
      ...(overrides.auth ?? {}),
    },
  };
  config.merge(base);
  return config;
}

test('secureCompare uses constant-time equality', () => {
  assert.equal(secureCompare('secret', 'secret'), true);
  assert.equal(secureCompare('secret', 'Secret'), false);
  assert.equal(secureCompare('short', 'longer'), false);
});

test('TrustProxies ignores X-Forwarded-For from untrusted peers', async () => {
  const { app } = miniApp({
    config: { app: { trustedProxies: ['10.0.0.1'] } },
  });
  const mw = new TrustProxies(app);
  const request = req('/api', {
    ip: '203.0.113.50',
    headers: { 'x-forwarded-for': '1.2.3.4' },
  });

  await mw.handle(request, async () => Response.text('ok'));
  assert.equal(request.ip(), '203.0.113.50');
});

test('TrustProxies trusts X-Forwarded-For only from configured proxies', async () => {
  const { app } = miniApp({
    config: { app: { trustedProxies: ['10.0.0.1'] } },
  });
  const mw = new TrustProxies(app);
  const request = req('/api', {
    ip: '10.0.0.1',
    headers: { 'x-forwarded-for': '198.51.100.10, 10.0.0.1' },
  });

  await mw.handle(request, async () => Response.text('ok'));
  assert.equal(request.ip(), '198.51.100.10');
});

test('Request.remoteAddress is not affected by TrustProxies', async () => {
  const { app } = miniApp({
    config: { app: { trustedProxies: ['10.0.0.1'] } },
  });
  const mw = new TrustProxies(app);
  const request = req('/api', {
    ip: '10.0.0.1',
    headers: { 'x-forwarded-for': '1.2.3.4' },
  });

  await mw.handle(request, async () => Response.text('ok'));
  assert.equal(request.remoteAddress(), '10.0.0.1');
  assert.equal(request.ip(), '1.2.3.4');
});

test('TokenAbilities rejects session auth without access token metadata', async () => {
  const { app } = miniApp();
  const mw = new TokenAbilities(app, 'profile.edit');
  const request = req('/api/profile');
  request.setAttribute('_user', { id: 1, name: 'A', email: 'a@x.com', role: 'user', guard: 'session' });

  const response = await mw.handle(request, async () => Response.json({ ok: true }));
  assert.equal(response.status, 403);
});

test('TokenAbilities allows personal access token with matching ability', async () => {
  const app = Object.assign(new Container(), { basePath: process.cwd(), debug: false });
  const tokens = {
    tokenCan(meta, ability) {
      return meta.abilities.includes(ability);
    },
  };
  app.make = (name) => {
    if (name === 'tokens') return tokens;
    throw new Error(name);
  };

  const mw = new TokenAbilities(app, 'profile.edit');
  const request = req('/api/profile');
  request.setAttribute('_user', { id: 1, guard: 'api' });
  request.setAttribute('_access_token', { abilities: ['profile.edit'] });

  let passed = false;
  await mw.handle(request, async () => {
    passed = true;
    return Response.json({ ok: true });
  });
  assert.equal(passed, true);
});

test('assertProductionEnv blocks debug in production', () => {
  const config = configWith({ app: { debug: true } });
  assert.throws(
    () => assertProductionEnv(config),
    /TAAND_DEBUG must be false/,
  );
});

test('assertProductionEnv blocks machine token in production without opt-in', () => {
  const config = configWith({
    auth: { tokens: { fallback: 'machine-secret' } },
    app: { allowMachineToken: false },
  });
  assert.throws(
    () => assertProductionEnv(config),
    /TAAND_API_TOKEN is blocked in production/,
  );
});

test('assertProductionEnv allows machine token when explicitly enabled', () => {
  const config = configWith({
    auth: { tokens: { fallback: 'machine-secret' } },
    app: { allowMachineToken: true },
  });
  assert.doesNotThrow(() => assertProductionEnv(config));
});

test('assertDevDashboard rejects spoofed X-Forwarded-For from remote socket', () => {
  const app = Object.assign(new Container(), {
    debug: true,
    make(name) {
      if (name === 'config') {
        return {
          get(key, fallback) {
            if (key === 'app.env') return 'local';
            if (key === 'app.devDashboardKey') return '';
            return fallback;
          },
        };
      }
      throw new Error(name);
    },
  });

  const request = req('/__Taand/cache', {
    ip: '203.0.113.1',
    headers: { 'x-forwarded-for': '127.0.0.1' },
  });
  request.setAttribute('_ip', '127.0.0.1');

  assert.throws(
    () => assertDevDashboard(app, request),
    (err) => err.status === 403,
  );
});

test('assertDevDashboard accepts localhost socket', () => {
  const app = Object.assign(new Container(), {
    debug: true,
    make(name) {
      if (name === 'config') {
        return {
          get(key, fallback) {
            if (key === 'app.env') return 'local';
            if (key === 'app.devDashboardKey') return '';
            return fallback;
          },
        };
      }
      throw new Error(name);
    },
  });

  assert.doesNotThrow(() => assertDevDashboard(app, req('/__Taand/cache')));
});

test('assertDevDashboard requires dashboard key when configured', () => {
  const app = Object.assign(new Container(), {
    debug: true,
    make(name) {
      if (name === 'config') {
        return {
          get(key, fallback) {
            if (key === 'app.env') return 'local';
            if (key === 'app.devDashboardKey') return 'dev-secret';
            return fallback;
          },
        };
      }
      throw new Error(name);
    },
  });

  assert.throws(
    () => assertDevDashboard(app, req('/__Taand/cache')),
    (err) => err.status === 403,
  );

  const withKey = req('/__Taand/cache?dashboard_key=dev-secret');
  assert.doesNotThrow(() => assertDevDashboard(app, withKey));
});

test('TaandCompiler blocks dangerous template expressions', () => {
  const compiler = new TaandCompiler();
  assert.throws(
    () => compiler.compile('{{ process }}'),
    /Unsafe expression blocked/,
  );
  assert.throws(
    () => compiler.compile('{{ Function("return 1") }}'),
    /Unsafe expression blocked/,
  );
  assert.throws(
    () => compiler.compile('{{ foo)(bar) }}'),
    /Unsafe expression blocked/,
  );
});

test('auth machine token sets access token metadata and uses secure compare', async () => {
  const app = Object.assign(new Container(), { basePath: process.cwd(), debug: false });
  const config = new Config();
  config.merge({
    auth: {
      tokens: {
        fallback: 'machine-secret',
        machineAbilities: ['health.read'],
      },
      session: { rememberDays: 14 },
      remember: { cookie: 'taand_remember' },
    },
    app: { key: 'test-key', env: 'local', allowMachineToken: true },
  });

  const hasher = new Hasher({ N: 1024, r: 8, p: 1, keyLength: 32 });
  const tokens = new PersonalAccessTokenManager(app);
  const users = new UserProvider(app);
  const sessions = { get: () => null, put: () => {}, forget: () => {}, regenerate: () => {} };

  app.make = (name) => {
    if (name === 'config') return config;
    if (name === 'db') return {};
    if (name === 'hasher') return hasher;
    if (name === 'users') return users;
    if (name === 'session') return sessions;
    if (name === 'tokens') return tokens;
    if (name === 'auth') return new AuthManager(app);
    throw new Error(`Unknown binding: ${name}`);
  };
  app.has = (name) => ['config', 'db', 'hasher', 'users', 'session', 'tokens', 'auth'].includes(name);

  const request = req('/api/health', {
    headers: { authorization: 'Bearer machine-secret' },
  });

  const auth = app.make('auth').forRequest(request).guard('api');
  const user = await auth.loadUser();

  assert.equal(user.machine, true);
  assert.equal(auth.accessToken().name, 'machine');
  assert.deepEqual(auth.accessToken().abilities, ['health.read']);
  assert.equal(auth.tokenCan('health.read'), true);
  assert.equal(auth.tokenCan('admin'), false);

  const badRequest = req('/api/health', {
    headers: { authorization: 'Bearer machine-secre' },
  });
  const badAuth = app.make('auth').forRequest(badRequest).guard('api');
  assert.equal(await badAuth.loadUser(), null);
});

test('auth tokenCan fails closed for session users', async () => {
  const app = Object.assign(new Container(), { basePath: process.cwd(), debug: false });
  const config = new Config();
  config.merge({
    auth: { tokens: { fallback: '' }, session: { rememberDays: 14 }, remember: { cookie: 'taand_remember' } },
    app: { key: 'test-key' },
  });
  const tokens = new PersonalAccessTokenManager(app);
  const hasher = new Hasher({ N: 1024, r: 8, p: 1, keyLength: 32 });
  const users = new UserProvider(app);
  const sessions = { get: () => null, put: () => {}, forget: () => {}, regenerate: () => {} };

  app.make = (name) => {
    if (name === 'config') return config;
    if (name === 'db') return {};
    if (name === 'hasher') return hasher;
    if (name === 'users') return users;
    if (name === 'session') return sessions;
    if (name === 'tokens') return tokens;
    if (name === 'auth') return new AuthManager(app);
    throw new Error(name);
  };
  app.has = (name) => true;

  const request = req('/dashboard');
  request.setAttribute('_user', { id: 1, guard: 'session' });
  const auth = app.make('auth').forRequest(request);
  assert.equal(auth.check(), true);
  assert.equal(auth.tokenCan('anything'), false);
});

test('remember-me cookie is Secure when sessions are secure', async () => {
  const app = Object.assign(new Container(), { basePath: process.cwd(), debug: false });
  const config = new Config();
  config.merge({
    auth: { session: { secure: true }, remember: { cookie: 'taand_remember' } },
    app: { key: 'test-key' },
  });
  const hasher = new Hasher({ N: 1024, r: 8, p: 1, keyLength: 32 });
  const users = { async updateRememberToken() {} };
  const sessions = { get: () => null, put: () => {}, forget: () => {}, regenerate: () => {} };

  app.make = (name) => {
    if (name === 'config') return config;
    if (name === 'hasher') return hasher;
    if (name === 'users') return users;
    if (name === 'session') return sessions;
    throw new Error(name);
  };
  app.has = () => false;

  const request = req('/login', { method: 'POST' });
  request.setAttribute('_session', {});
  await new AuthManager(app).forRequest(request).login({ id: 1, role: 'user' }, true);

  assert.match(request.attribute('_remember_cookie'), /; Secure(;|$)/);
});
