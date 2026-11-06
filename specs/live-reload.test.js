import test from 'node:test';
import assert from 'node:assert/strict';
import { LiveReload } from '../engine/dev/LiveReload.js';

function liveStatus(host) {
  const config = { get: (key, fallback) => ({ 'app.env': 'local', 'app.url': 'http://myapp.test:2977' })[key] ?? fallback };
  const live = new LiveReload({ make: () => config });
  const res = { status: null, writeHead(status) { this.status = status; }, write() {}, end() {} };
  live.handleLiveRequest({ url: '/_Taand/live', headers: { host }, on() {} }, res);
  live.stop();
  return res.status;
}

test('live reload stream rejects non-local Host (DNS rebinding)', () => {
  assert.equal(liveStatus('attacker.example:2977'), 403);
  assert.equal(liveStatus(undefined), 403);
});

test('live reload stream accepts local and configured app hosts', () => {
  for (const host of ['127.0.0.1:2977', 'localhost:2977', '[::1]:2977', 'myapp.test:2977']) {
    assert.equal(liveStatus(host), 200);
  }
});
