import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { Config } from '../engine/core/Config.js';
import { LogManager } from '../engine/logging/LogManager.js';

test('request log context does not leak between concurrent requests', async () => {
  const basePath = fs.mkdtempSync(path.join(os.tmpdir(), 'taand-log-'));
  const config = new Config();
  config.merge({
    logging: {
      default: 'single',
      channels: { single: { driver: 'single', path: 'storage/logs/test.log' } },
    },
  });
  const log = new LogManager({ basePath, make: () => config });

  async function request(ip, delay) {
    log.setRequestContext({ ip });
    await sleep(delay);
    log.info('handled', { expected: ip });
    log.clearRequestContext();
  }

  try {
    await Promise.all([request('203.0.113.1', 20), request('203.0.113.2', 5)]);
    await log.flush();

    const records = fs.readFileSync(path.join(basePath, 'storage/logs/test.log'), 'utf8')
      .trim().split('\n').map((line) => JSON.parse(line));
    assert.equal(records.length, 2);
    for (const record of records) {
      assert.equal(record.context.ip, record.context.expected);
    }
  } finally {
    fs.rmSync(basePath, { recursive: true, force: true });
  }
});
