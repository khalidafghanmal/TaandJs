import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';

import { FileWatcher } from '../engine/dev/FileWatcher.js';

test('FileWatcher ignores dirs relative to the project, not parent dirs named storage', async () => {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'taand-watch-'));
  const base = path.join(tmp, 'storage', 'apps', 'demo');
  await fs.mkdir(path.join(base, 'ui', 'node_modules'), { recursive: true });

  const changes = new Set();
  const watcher = new FileWatcher(base, {
    paths: ['ui'],
    onChange: (file) => changes.add(path.relative(base, file)),
  });
  watcher.start();

  try {
    await sleep(100);
    await fs.writeFile(path.join(base, 'ui', 'node_modules', 'dep.taand'), 'x');
    await fs.writeFile(path.join(base, 'ui', 'home.taand'), 'hi');

    for (let i = 0; i < 30 && !changes.size; i++) await sleep(100);
    await sleep(300);

    assert.ok(changes.has(path.join('ui', 'home.taand')), `changes: ${[...changes]}`);
    assert.ok(![...changes].some((f) => f.includes('node_modules')), `changes: ${[...changes]}`);
  } finally {
    watcher.stop();
    await fs.rm(tmp, { recursive: true, force: true });
  }
});
