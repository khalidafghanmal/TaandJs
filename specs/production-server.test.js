import test from 'node:test';
import assert from 'node:assert/strict';

import { Config } from '../engine/core/Config.js';
import { ProductionServer } from '../engine/server/ProductionServer.js';

test('ProductionServer starts and stops cleanly', async () => {
  const config = new Config();
  config.set('server', { host: '127.0.0.1', port: 0, openBrowser: false, gracefulShutdownMs: 1000 });
  config.set('app', { key: 'test-key-0123456789abcdef0123456789', env: 'testing' });
  config.set('database', { url: 'postgresql://user:pass@127.0.0.1:5432/test' });
  const app = { make: (name) => (name === 'config' ? config : null), has: () => false };

  const server = new ProductionServer(app);
  try {
    const { url } = await server.start();
    assert.match(url, /^http:\/\/127\.0\.0\.1:/);
  } finally {
    await server.stop();
  }
});
