import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import path from 'node:path';

import { Config } from '../engine/core/Config.js';
import { assertProductionEnv } from '../engine/core/ProductionEnvValidator.js';

const ROOT = path.resolve(import.meta.dirname, '..');

test('settings/data.js defaults to the SQLite database the schema uses', () => {
  const env = { ...process.env };
  delete env.DB_CONNECTION;
  delete env.DATABASE_URL;
  const out = execFileSync(
    process.execPath,
    ['--input-type=module', '-e', "const m = await import('./settings/data.js'); console.log(JSON.stringify(m.default.primary));"],
    { cwd: ROOT, env, encoding: 'utf8' },
  );
  assert.deepEqual(JSON.parse(out), {
    connection: 'sqlite',
    url: 'file:../storage/database/taand.db',
  });
});

function productionConfig(url) {
  const config = new Config();
  config.set('app', { key: 'test-production-key-32chars-minimum', env: 'production', debug: false });
  config.set('database', { url });
  return config;
}

test('assertProductionEnv rejects the shipped example database URLs in production', () => {
  for (const url of [
    'file:../storage/database/taand.db',
    'postgresql://postgres:postgres@127.0.0.1:5432/taand?schema=public',
  ]) {
    assert.throws(() => assertProductionEnv(productionConfig(url)), /example value/, url);
  }
});

test('assertProductionEnv accepts a real database URL in production', () => {
  assert.doesNotThrow(() => assertProductionEnv(productionConfig('postgresql://app:s3cret@db.internal:5432/app')));
});
