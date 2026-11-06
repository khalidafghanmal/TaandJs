import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { LocalDriver } from '../engine/storage/drivers/LocalDriver.js';
import { AssetManager } from '../engine/assets/AssetManager.js';
import platform from '../settings/platform.js';

describe('LocalDriver', () => {
  let tmp;
  let app;

  before(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'taand-storage-'));
    app = { basePath: tmp };
  });

  after(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it('put, get, exists, delete', async () => {
    const driver = new LocalDriver(app, { root: 'uploads', url: '/storage' });
    await driver.put('test/hello.txt', Buffer.from('hello'));
    assert.equal(await driver.exists('test/hello.txt'), true);
    assert.equal((await driver.get('test/hello.txt')).toString(), 'hello');
    assert.match(driver.url('test/hello.txt'), /\/storage\/test\/hello.txt/);
    assert.equal(await driver.delete('test/hello.txt'), true);
    assert.equal(await driver.exists('test/hello.txt'), false);
  });
});

describe('local disk and static serving', () => {
  it('files put on the local disk are served from their url', async () => {
    const basePath = fs.mkdtempSync(path.join(os.tmpdir(), 'taand-storage-'));
    try {
      const config = { get: (key, fallback) => (key === 'assets' ? platform.static : fallback) };
      const app = { basePath, make: () => config };
      const driver = new LocalDriver(app, platform.volumes.disks.local);
      await driver.put('avatars/a.png', Buffer.from('png'));

      const served = new AssetManager(app).resolvePublic(driver.url('avatars/a.png'));
      assert.ok(served, 'static server could not find the stored file');
      assert.equal(fs.readFileSync(served, 'utf8'), 'png');
    } finally {
      fs.rmSync(basePath, { recursive: true, force: true });
    }
  });
});
