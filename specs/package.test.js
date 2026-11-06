import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');

test('.env is gitignored', () => {
  const out = execFileSync('git', ['check-ignore', '--no-index', '.env'], { cwd: ROOT, encoding: 'utf8' });
  assert.equal(out.trim(), '.env');
});

test('npm package does not ship .env or runtime storage', () => {
  const out = execFileSync('npm', ['pack', '--dry-run', '--json', '--ignore-scripts'], {
    cwd: ROOT,
    encoding: 'utf8',
    shell: process.platform === 'win32',
  });
  const files = JSON.parse(out)[0].files.map((f) => f.path);

  assert.ok(files.includes('engine/index.js'));
  assert.ok(files.includes('bin/taand.js'));
  assert.ok(files.includes('.env.example'));
  assert.ok(!files.includes('.env'), '.env would be published');
  assert.deepEqual(files.filter((f) => f.startsWith('storage/') || f.endsWith('.db')), []);
});
