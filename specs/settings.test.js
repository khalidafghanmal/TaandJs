import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  normalizeSettings,
  loadSettingsRegistry,
  SETTINGS_MODULES,
} from '../engine/core/SettingsLoader.js';
import { applyServeDefaults } from '../engine/cli/runners/serve.js';

const basePath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('settings modules exist on disk', () => {
  for (const name of SETTINGS_MODULES) {
    const file = path.join(basePath, 'settings', `${name}.js`);
    assert.equal(fs.existsSync(file), true, `missing ${file}`);
  }
});

test('normalizeSettings maps taand-native keys to engine registry', () => {
  const registry = normalizeSettings({
    runtime: { env: 'local', debug: true },
    server: { port: 8000 },
    ui: { cache: true },
    http: {
      global: ['log'],
      stacks: { browser: ['csrf'], json: ['json'] },
      filters: { signedIn: 'authenticate', signedOut: 'guestOnly' },
      priority: ['log'],
      crossOrigin: { enabled: true },
    },
    security: {
      defaultMode: 'browser',
      browser: {
        session: { cookie: 'taand_session' },
        remember: { cookie: 'taand_remember' },
        pages: { login: '/login' },
      },
      token: { prefix: 'tok_', fallback: 'secret', machineAbilities: ['*'] },
      accounts: { users: { driver: 'prisma', model: 'user' } },
      hashing: { scrypt: { N: 16384 } },
      roles: { hierarchy: { admin: 100 } },
    },
    data: {
      primary: { url: 'postgresql://localhost/taand' },
      redis: { default: 'default' },
    },
    platform: {
      memory: { default: 'file' },
      jobs: { default: 'sync' },
      notify: { default: 'array' },
      observability: { default: 'stack' },
      dispatch: { maxListeners: 50 },
      volumes: { default: 'local' },
      static: { url: '' },
    },
    errors: { pages: {} },
    validation: { messages: {} },
  });

  assert.equal(registry.app.env, 'local');
  assert.deepEqual(registry.middleware.groups.web, ['csrf']);
  assert.deepEqual(registry.middleware.groups.api, ['json']);
  assert.equal(registry.middleware.aliases.auth, 'authenticate');
  assert.equal(registry.auth.default, 'session');
  assert.equal(registry.auth.session.cookie, 'taand_session');
  assert.equal(registry.database.url, 'postgresql://localhost/taand');
  assert.equal(registry.cache.default, 'file');
  assert.equal(registry.queue.default, 'sync');
  assert.equal(registry.mail.default, 'array');
});

test('loadSettingsRegistry loads project settings', async () => {
  const registry = await loadSettingsRegistry(basePath);
  assert.equal(registry.app.name, 'TaandJs');
  assert.equal(registry.auth.default, 'session');
  assert.deepEqual(registry.middleware.groups.web, ['startSession', 'csrf']);
  assert.equal(registry.cors.enabled, true);
});

test('production server defaults to production with debug off when TAAND_ENV is unset', async () => {
  const saved = { TAAND_ENV: process.env.TAAND_ENV, TAAND_DEBUG: process.env.TAAND_DEBUG };
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'taand-serve-'));

  try {
    delete process.env.TAAND_ENV;
    delete process.env.TAAND_DEBUG;
    applyServeDefaults(tmp);
    assert.equal(process.env.TAAND_ENV, 'production');
    const runtime = (await import(`../settings/runtime.js?t=${Date.now()}`)).default;
    assert.equal(runtime.debug, false);

    // An explicit TAAND_ENV in .env still wins.
    delete process.env.TAAND_ENV;
    fs.writeFileSync(path.join(tmp, '.env'), 'TAAND_ENV=local\n');
    applyServeDefaults(tmp);
    assert.equal(process.env.TAAND_ENV, 'local');
  } finally {
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('npm start applies production defaults before the app module loads', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'taand-serve-app-'));
  const url = (rel) => pathToFileURL(path.join(basePath, rel)).href;

  // Stub app: records TAAND_ENV seen at import time (where Prisma's dotenv and user code run),
  // then the effective settings at bootstrap, and stops runServe before it binds a port.
  fs.mkdirSync(path.join(tmp, 'start'));
  fs.writeFileSync(path.join(tmp, 'start', 'app.js'), `
import { loadSettingsRegistry } from ${JSON.stringify(url('engine/core/SettingsLoader.js'))};
globalThis.__seen = { importEnv: process.env.TAAND_ENV };
export const app = {
  basePath: ${JSON.stringify(tmp)},
  async bootstrap() {
    const registry = await loadSettingsRegistry(${JSON.stringify(basePath)});
    Object.assign(globalThis.__seen, { env: registry.app.env, debug: registry.app.debug });
    throw new Error('stop');
  },
};
`);
  fs.writeFileSync(path.join(tmp, 'run.mjs'), `
const { runServe } = await import(${JSON.stringify(url('engine/cli/runners/serve.js'))});
await runServe().catch((err) => { if (err.message !== 'stop') throw err; });
console.log(JSON.stringify(globalThis.__seen));
`);

  const env = { ...process.env, TAAND_BASE_PATH: tmp };
  delete env.TAAND_ENV;
  delete env.TAAND_DEBUG;

  try {
    const child = spawnSync(process.execPath, [path.join(tmp, 'run.mjs')], { cwd: tmp, env, encoding: 'utf8' });
    assert.equal(child.status, 0, child.stderr);
    const seen = JSON.parse(child.stdout.trim().split('\n').pop());
    assert.deepEqual(seen, { importEnv: 'production', env: 'production', debug: false });
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});
