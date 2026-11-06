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

async function lockDrivers() {
  const { MemoryDriver } = await import('../engine/cache/drivers/MemoryDriver.js');
  const { RedisDriver } = await import('../engine/cache/drivers/RedisDriver.js');
  const data = new Map();
  const client = {
    // Stand-in for the compare-and-delete Lua script: delete only when the stored value matches.
    async eval(_script, { keys: [key], arguments: [owner] }) {
      const raw = data.get(key);
      if (raw === undefined || String(JSON.parse(raw).value) !== owner) return 0;
      data.delete(key);
      return 1;
    },
  };
  const connection = {
    get: async (key) => data.get(key) ?? null,
    set: async (key, value) => { data.set(key, value); return 'OK'; },
    setEx: async (key, _seconds, value) => { data.set(key, value); return 'OK'; },
    del: async (key) => (data.delete(key) ? 1 : 0),
    prefix: () => '',
    raw: async () => client,
  };
  return {
    memory: new MemoryDriver(),
    redis: new RedisDriver({ make: () => ({ connection: () => connection }) }, { connection: 'cache' }),
  };
}

for (const name of ['memory', 'redis']) {
  test(`${name} lock release does not delete a lock re-acquired by another owner`, async () => {
    const { CacheLock } = await import('../engine/cache/CacheLock.js');
    const driver = (await lockDrivers())[name];
    const lock = new CacheLock(driver, 'job', 10, 'owner-a');
    assert.equal(await lock.get(), true);

    // A's lock expires and owner B takes it right after release() first touches the driver.
    // A non-atomic get-then-forget would then delete B's lock.
    const realGet = driver.get.bind(driver);
    let takenOver = false;
    for (const method of ['get', 'forgetIf']) {
      const real = driver[method]?.bind(driver);
      if (!real) continue;
      driver[method] = async (...args) => {
        const result = await real(...args);
        if (!takenOver) {
          takenOver = true;
          await driver.forget('__lock:job');
          await driver.put('__lock:job', 'owner-b', 10);
        }
        return result;
      };
    }

    await lock.release();
    assert.equal(await realGet('__lock:job'), 'owner-b');
  });

  test(`${name} lock release frees a lock it still owns`, async () => {
    const { CacheLock } = await import('../engine/cache/CacheLock.js');
    const driver = (await lockDrivers())[name];
    const lock = new CacheLock(driver, 'job', 10, 'owner-a');
    assert.equal(await lock.get(), true);
    assert.equal(await lock.release(), true);
    assert.equal(await new CacheLock(driver, 'job', 10, 'owner-b').get(), true);
  });
}
