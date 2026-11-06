import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { COPY_DIRS, productionPackageJson } from '../bin/build.js';

const ROOT = path.resolve(import.meta.dirname, '..');
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));

test('build copies settings/ and only directories that exist', () => {
  assert.ok(COPY_DIRS.includes('settings'));
  for (const dir of COPY_DIRS) {
    assert.ok(fs.existsSync(path.join(ROOT, dir)), `${dir}/ does not exist`);
  }
});

test('build package.json keeps every runtime dependency', () => {
  const production = productionPackageJson(pkg);
  assert.deepEqual(production.dependencies, pkg.dependencies);
  assert.equal(production.devDependencies, undefined);
});
