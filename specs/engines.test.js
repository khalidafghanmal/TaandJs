import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');

test('engines.node matches the Node features the tooling needs and the CI matrix', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  // `node --test "specs/**/*.test.js"` globs need Node 21+, recursive fs.watch on Linux needs 20+.
  const min = Number(/^>=\s*(\d+)/.exec(pkg.engines.node)?.[1]);
  assert.ok(min >= 22, `engines.node is ${pkg.engines.node}`);

  const ci = fs.readFileSync(path.join(ROOT, '.github', 'workflows', 'ci.yml'), 'utf8');
  const matrix = /node:\s*\[([^\]]+)\]/.exec(ci)[1].split(',').map(Number);
  assert.ok(matrix.includes(min), `CI matrix ${matrix} does not test the minimum Node ${min}`);
  assert.ok(matrix.every((v) => v >= min));
});
