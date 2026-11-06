import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { Uploader } from '../engine/assets/Uploader.js';
import { sniffMime } from '../engine/assets/mime.js';
import platform from '../settings/platform.js';

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

describe('Uploader type validation', () => {
  let tmp;
  let uploader;

  before(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'taand-upload-'));
    const services = {
      assets: { storageDir: tmp, storageUrl: (p) => `/storage/${p}` },
      config: { get: (key, fallback) => (key === 'assets' ? platform.static : fallback) },
    };
    uploader = new Uploader({ make: (name) => services[name], has: () => false });
  });

  after(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it('stores the extension of the sniffed type, not the client name', async () => {
    const payload = Buffer.concat([PNG, Buffer.from('body{background:url(//evil)}')]);
    const file = await uploader.save(payload, 'x.css', { type: 'image' });
    assert.equal(file.mime, 'image/png');
    assert.equal(path.extname(file.name), '.png');
  });

  it('rejects image uploads whose bytes match no signature', async () => {
    await assert.rejects(uploader.save(Buffer.from('<p>hello</p>'), 'x.png', { type: 'image' }));
  });

  it('rejects a declared type whose signature does not match the bytes', async () => {
    await assert.rejects(uploader.save(Buffer.from('\0\0\0 not a video'), 'x.mp4', { type: 'video' }));
  });

  it('only sniffs mp4 when the ftyp box is present', () => {
    assert.equal(sniffMime(Buffer.from('\0\0\0 body{}')), null);
    assert.equal(sniffMime(Buffer.from('\0\0\0\x18ftypmp42')), 'video/mp4');
  });

  it('still accepts types without a signature by extension', async () => {
    const file = await uploader.save(Buffer.from('hello'), 'notes.txt', { type: 'document' });
    assert.equal(file.mime, 'text/plain');
    assert.equal(path.extname(file.name), '.txt');
  });
});
