import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';

import { shouldGenerate, generateOutcome } from '../bin/postinstall.js';

const pkg = path.resolve('/work/app');

test('postinstall runs only when installing the project itself', () => {
  assert.equal(shouldGenerate({ initCwd: pkg, packageDir: pkg }), true);
  assert.equal(shouldGenerate({ initCwd: path.join(pkg, 'src'), packageDir: pkg }), true);
  assert.equal(shouldGenerate({ initCwd: undefined, packageDir: pkg }), true);
  assert.equal(
    shouldGenerate({ initCwd: path.resolve('/work/other'), packageDir: path.resolve('/work/other/node_modules/taandjs') }),
    false,
  );
});

test('postinstall only tolerates Windows file-lock failures', () => {
  const lock = "EPERM: operation not permitted, rename 'query_engine-windows.dll.node.tmp1' -> 'query_engine-windows.dll.node'";
  const base = { platform: 'win32', attempt: 1, maxAttempts: 3 };

  assert.equal(generateOutcome({ ...base, code: 0, output: '' }), 'done');
  assert.equal(generateOutcome({ ...base, code: 1, output: lock }), 'retry');
  assert.equal(generateOutcome({ ...base, code: 1, output: 'EBUSY: resource busy or locked', attempt: 3 }), 'warn');
  assert.equal(generateOutcome({ ...base, code: 1, output: 'Error validating schema: P1012' }), 'fail');
  assert.equal(generateOutcome({ ...base, platform: 'linux', code: 1, output: lock }), 'fail');
});
