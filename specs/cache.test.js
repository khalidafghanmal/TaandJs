import test from 'node:test';
import assert from 'node:assert/strict';
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

test('redis cache stores keys under the connection prefix and flush clears them', async () => {
  const { RedisDriver } = await import('../engine/cache/drivers/RedisDriver.js');
  const data = new Map([['other:app:key', 'keep']]);
  const client = {
    async get(key) { return data.get(key) ?? null; },
    async set(key, value) { data.set(key, value); return 'OK'; },
    async setEx(key, _seconds, value) { data.set(key, value); return 'OK'; },
    async del(keys) { return [].concat(keys).filter((k) => data.delete(k)).length; },
    async ttl(key) { return data.has(key) ? 60 : -2; },
    async keys() { throw new Error('KEYS blocks the server; use SCAN'); },
    async *scanIterator({ MATCH }) {
      const literal = MATCH.slice(0, -1).replace(/\\(.)/g, '$1');
      yield [...data.keys()].filter((k) => k.startsWith(literal));
    },
  };
  const connection = {
    get: (...args) => client.get(...args),
    set: (...args) => client.set(...args),
    setEx: (...args) => client.setEx(...args),
    del: (...args) => client.del(...args),
    prefix: () => 'Taand:cache:',
    raw: async () => client,
  };
  const driver = new RedisDriver({ make: () => ({ connection: () => connection }) }, { connection: 'cache' });

  await driver.put('user:1', { name: 'Ada' }, 60);
  await driver.put('forever', 'x');
  assert.ok(data.has('Taand:cache:user:1'));
  assert.deepEqual((await driver.get('user:1')), { name: 'Ada' });
  assert.equal(await driver.ttl('user:1'), 60);
  assert.deepEqual((await driver.keys()).sort(), ['forever', 'user:1']);

  await driver.flush();
  assert.equal(await driver.get('user:1'), undefined);
  assert.deepEqual([...data.keys()], ['other:app:key']);
});
