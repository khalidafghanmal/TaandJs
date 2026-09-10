import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  normalizeSettings,
  loadSettingsRegistry,
  SETTINGS_MODULES,
} from '../engine/core/SettingsLoader.js';

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
