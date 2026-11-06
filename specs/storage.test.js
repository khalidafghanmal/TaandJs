import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { S3Client } from '@aws-sdk/client-s3';
import { LocalDriver } from '../engine/storage/drivers/LocalDriver.js';
import { S3Driver } from '../engine/storage/drivers/S3Driver.js';
import { Uploader } from '../engine/assets/Uploader.js';
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

describe('S3 visibility', () => {
  let sent;
  let originalSend;
  const s3Config = { ...platform.volumes.disks.s3, bucket: 'test-bucket', key: 'k', secret: 's' };

  before(() => {
    originalSend = S3Client.prototype.send;
    S3Client.prototype.send = async function send(command) {
      sent.push(command.input);
      return {};
    };
  });

  after(() => {
    S3Client.prototype.send = originalSend;
  });

  it('default s3 disk writes private objects', async () => {
    sent = [];
    await new S3Driver({}, s3Config).put('invoices/1.pdf', Buffer.from('%PDF'));
    assert.equal(sent[0].ACL, undefined);
  });

  it('uploader still publishes uploads it returns a public URL for', async () => {
    sent = [];
    const disk = new S3Driver({}, s3Config);
    const config = { get: (key, fallback) => (key === 'assets' ? platform.static : fallback) };
    const services = { assets: {}, config, storage: { disk: () => disk } };
    const uploader = new Uploader({ make: (name) => services[name], has: () => true });
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    await uploader.save(png, 'a.png', { type: 'image', disk: 's3' });
    assert.equal(sent[0].ACL, 'public-read');
  });
});
