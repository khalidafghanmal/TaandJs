import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { shouldSkip } from '../packages/create-taand/lib/create-project.js';

const execFileAsync = promisify(execFile);
const TAAND_ROOT = path.resolve(import.meta.dirname, '..');
const CREATE_BIN = path.join(TAAND_ROOT, 'bin', 'create.js');

test('create-taand excludes match from the template root only', () => {
  assert.equal(shouldSkip(path.join('engine', 'storage'), true), false);
  assert.equal(shouldSkip(path.join('engine', 'cli', 'stubs'), true), false);
  assert.equal(shouldSkip('node_modules', true), true);
  assert.equal(shouldSkip(path.join('storage', 'database', 'taand.db'), false), true);
  assert.equal(shouldSkip(path.join('storage', 'logs', 'taand.log'), false), true);
  assert.equal(shouldSkip('.env', false), true);
});

test('create-taand scaffolds the engine without local runtime data', async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'taand-create-'));
  try {
    await execFileAsync(process.execPath, [CREATE_BIN, 'app', '--no-install'], { cwd: tmp });
    const app = path.join(tmp, 'app');

    assert.ok(fs.existsSync(path.join(app, 'engine', 'cli', 'stubs', 'controller.stub')));
    assert.ok(fs.existsSync(path.join(app, 'engine', 'storage', 'StorageManager.js')));
    assert.ok(fs.existsSync(path.join(app, '.env.example')));

    const storage = path.join(app, 'storage');
    const files = fs.existsSync(storage) ? fs.readdirSync(storage, { recursive: true }) : [];
    assert.ok(!files.some((f) => f.endsWith('.db')), 'database copied into new app');
    assert.ok(!files.some((f) => f.endsWith('.log')), 'logs copied into new app');
    assert.ok(!files.some((f) => f.endsWith('routes.json')), 'cli cache copied into new app');
    assert.ok(!fs.existsSync(path.join(app, 'packages')));
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('create-taand runs when invoked through a symlink', { skip: process.platform === 'win32' }, async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'taand-create-'));
  try {
    const link = path.join(tmp, 'create-taand');
    fs.symlinkSync(CREATE_BIN, link);
    await execFileAsync(process.execPath, [link, 'app', '--no-install'], { cwd: tmp });
    assert.ok(fs.existsSync(path.join(tmp, 'app', 'package.json')));
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});
