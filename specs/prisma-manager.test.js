import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { Config } from '../engine/core/Config.js';
import { PrismaManager } from '../engine/database/PrismaManager.js';

test('relative SQLite URLs resolve against schema/, like the Prisma CLI', async () => {
  const basePath = fs.mkdtempSync(path.join(os.tmpdir(), 'taand-prisma-'));
  fs.mkdirSync(path.join(basePath, 'schema'));
  fs.mkdirSync(path.join(basePath, 'prisma'));
  const config = new Config();
  config.set('database', { url: 'file:./x.db' });
  const manager = new PrismaManager({ basePath, make: () => config });

  try {
    await manager.connect();
    assert.ok(fs.existsSync(path.join(basePath, 'schema', 'x.db')), 'expected schema/x.db');
    assert.ok(!fs.existsSync(path.join(basePath, 'prisma', 'x.db')));
  } finally {
    await manager.disconnect();
    fs.rmSync(basePath, { recursive: true, force: true });
  }
});
