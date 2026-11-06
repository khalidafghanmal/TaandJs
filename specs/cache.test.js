import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { CacheManager } from '../engine/cache/CacheManager.js';
import { Container } from '../engine/core/Container.js';
import { Config } from '../engine/core/Config.js';

function cacheApp(overrides = {}) {
  const app = Object.assign(new Container(), { basePath: process.cwd(), debug: false });
  const config = new Config();
  config.merge({
    cache: {
      default: 'memory',
      prefix: 'test_',
      stores: {
        memory: { driver: 'memory', maxEntries: 100, maxBytes: 1024 * 1024 },
        null: { driver: 'null' },
      },
    },
    ...(overrides.config ?? {}),
  });
  app.make = (name) => {
    if (name === 'config') return config;
    return null;
  };
  return { app, cache: new CacheManager(app) };
}

test('cache put and get', async () => {
  const { cache } = cacheApp();
  await cache.put('key', 'value', 60);
  assert.equal(await cache.get('key'), 'value');
});

test('cache has and forget', async () => {
  const { cache } = cacheApp();
  await cache.put('foo', 42);
  assert.equal(await cache.has('foo'), true);
  await cache.forget('foo');
  assert.equal(await cache.has('foo'), false);
});

test('cache remember computes once', async () => {
  const { cache } = cacheApp();
  let calls = 0;
  const v1 = await cache.remember('rkey', 60, async () => {
    calls += 1;
    return 'computed';
  });
  const v2 = await cache.remember('rkey', 60, async () => {
    calls += 1;
    return 'again';
  });
  assert.equal(v1, 'computed');
  assert.equal(v2, 'computed');
  assert.equal(calls, 1);
});

test('cache increment and decrement', async () => {
  const { cache } = cacheApp();
  assert.equal(await cache.increment('counter'), 1);
  assert.equal(await cache.increment('counter', 4), 5);
  assert.equal(await cache.decrement('counter', 2), 3);
});

test('cache increment with ttl preserves expiry on later hits', async () => {
  const { cache } = cacheApp();
  assert.equal(await cache.increment('hits', 1, 60), 1);
  assert.equal(await cache.increment('hits', 1, 60), 2);
  assert.equal(await cache.get('hits'), 2);
});

test('RateLimiter hit does not wipe counter ttl', async () => {
  const { RateLimiter } = await import('../engine/http/RateLimiter.js');
  const { app, cache } = cacheApp();
  const config = app.make('config');
  app.make = (name) => {
    if (name === 'config') return config;
    if (name === 'cache') return cache;
    return null;
  };
  const limiter = new RateLimiter(app);
  assert.equal(await limiter.hit('ip:1', 60), 1);
  assert.equal(await limiter.hit('ip:1', 60), 2);
  assert.equal(await limiter.attempts('ip:1'), 2);
});

test('cache null driver discards values', async () => {
  const app = Object.assign(new Container(), { basePath: process.cwd() });
  const config = new Config();
  config.merge({
    cache: {
      default: 'null',
      prefix: '',
      stores: { null: { driver: 'null' } },
    },
  });
  app.make = (name) => (name === 'config' ? config : null);
  const cache = new CacheManager(app);
  await cache.put('x', 'y');
  assert.equal(await cache.has('x'), false);
});

function fakeRedisClient() {
  const store = new Map();
  const tick = () => new Promise((resolve) => setImmediate(resolve));
  const live = (key) => {
    const entry = store.get(key);
    if (entry?.expiresAt != null && Date.now() >= entry.expiresAt) {
      store.delete(key);
      return undefined;
    }
    return entry;
  };
  const setNow = (key, value, opts = {}) => {
    if (opts.NX && live(key)) return null;
    const ms = opts.PX ?? (opts.EX != null ? opts.EX * 1000 : null);
    store.set(key, { value: String(value), expiresAt: ms != null ? Date.now() + ms : null });
    return 'OK';
  };
  const incrByNow = (key, amount) => {
    const entry = live(key);
    if (entry && !/^-?\d+$/.test(entry.value)) throw new Error('ERR value is not an integer or out of range');
    const next = (entry ? Number(entry.value) : 0) + amount;
    store.set(key, { value: String(next), expiresAt: entry?.expiresAt ?? null });
    return next;
  };

  return {
    async get(key) { await tick(); return live(key)?.value ?? null; },
    async set(key, value, opts) { await tick(); return setNow(key, value, opts); },
    async setEx(key, seconds, value) { await tick(); return setNow(key, value, { EX: seconds }); },
    async del(key) { await tick(); return store.delete(key) ? 1 : 0; },
    async incrBy(key, amount) { await tick(); return incrByNow(key, amount); },
    async ttl(key) {
      await tick();
      const entry = live(key);
      if (!entry) return -2;
      if (entry.expiresAt == null) return -1;
      return Math.round((entry.expiresAt - Date.now()) / 1000);
    },
    async keys() { return [...store.keys()]; },
    multi() {
      const ops = [];
      const chain = {
        set: (...args) => { ops.push(() => setNow(...args)); return chain; },
        incrBy: (...args) => { ops.push(() => incrByNow(...args)); return chain; },
        exec: async () => { await tick(); return ops.map((op) => op()); },
      };
      return chain;
    },
  };
}

function storeApp(driver, t) {
  const basePath = fs.mkdtempSync(path.join(os.tmpdir(), 'taand-cache-'));
  t.after(() => fs.rmSync(basePath, { recursive: true, force: true }));

  const client = fakeRedisClient();
  const connection = {
    get: (...args) => client.get(...args),
    set: (...args) => client.set(...args),
    setEx: (...args) => client.setEx(...args),
    del: (...args) => client.del(...args),
    prefix: () => '',
    raw: async () => client,
  };

  const app = Object.assign(new Container(), { basePath, debug: false });
  const config = new Config();
  config.merge({
    cache: {
      default: driver,
      prefix: 'test_',
      stores: {
        memory: { driver: 'memory' },
        file: { driver: 'file', path: 'storage/cache/data' },
        redis: { driver: 'redis', connection: 'cache' },
      },
    },
  });
  app.make = (name) => {
    if (name === 'config') return config;
    if (name === 'redis') return { connection: () => connection };
    return null;
  };
  return { app, cache: new CacheManager(app), client };
}

for (const driver of ['memory', 'file', 'redis']) {
  test(`${driver} cache concurrent add lets exactly one caller win`, async (t) => {
    const { cache } = storeApp(driver, t);
    const results = await Promise.all(Array.from({ length: 10 }, (_, i) => cache.add('once', i, 60)));
    assert.equal(results.filter(Boolean).length, 1);
  });

  test(`${driver} cache concurrent lock acquire is exclusive`, async (t) => {
    const { cache } = storeApp(driver, t);
    const results = await Promise.all([cache.lock('job', 10).get(), cache.lock('job', 10).get()]);
    assert.deepEqual(results.sort(), [false, true]);
  });

  test(`${driver} cache concurrent increments are not lost`, async (t) => {
    const { cache } = storeApp(driver, t);
    await Promise.all(Array.from({ length: 25 }, () => cache.increment('hits', 1, 60)));
    assert.equal(await cache.get('hits'), 25);
  });

  test(`${driver} cache increment works on a value written by put`, async (t) => {
    const { cache } = storeApp(driver, t);
    await cache.put('count', 5, 60);
    assert.equal(await cache.increment('count', 2), 7);
    assert.equal(await cache.get('count'), 7);
  });
}

test('file cache concurrent puts to the same key do not throw', async (t) => {
  const { cache } = storeApp('file', t);
  await Promise.all(Array.from({ length: 20 }, (_, i) => cache.put('same', i, 60)));
  assert.equal(typeof (await cache.get('same')), 'number');
});

test('redis cache increment keeps the counter ttl', async (t) => {
  const { cache, client } = storeApp('redis', t);
  await cache.increment('rate', 1, 60);
  await cache.increment('rate', 1, 60);
  assert.ok((await client.ttl('test_rate')) > 0);
});
