import test from 'node:test';
import assert from 'node:assert/strict';
import { RedisDriver } from '../engine/queue/drivers/RedisDriver.js';

// In-memory stand-in for the node-redis client methods the driver uses.
function fakeRedis() {
  const lists = new Map();
  const zsets = new Map();
  const hashes = new Map();
  const strings = new Map();
  const live = (key) => strings.get(key)?.expires > Date.now();
  const tick = () => new Promise((r) => setImmediate(r));
  const get = (map, key, make) => {
    if (!map.has(key)) map.set(key, make());
    return map.get(key);
  };

  const client = {
    keysCalls: 0,
    async setEx(key, ttl, value) { await tick(); strings.set(key, { value, expires: Date.now() + ttl * 1000 }); },
    async get(key) { await tick(); return live(key) ? strings.get(key).value : null; },
    async del(keys) { await tick(); [keys].flat().forEach((k) => strings.delete(k)); },
    async keys(pattern) {
      await tick();
      client.keysCalls += 1;
      const parts = pattern.split('*');
      return [...strings.keys()].filter((k) => live(k) && k.startsWith(parts[0]) && k.endsWith(parts.at(-1)));
    },
    async lPush(key, value) { await tick(); return get(lists, key, () => []).unshift(value); },
    async rPop(key) { await tick(); return get(lists, key, () => []).pop() ?? null; },
    async lLen(key) { await tick(); return get(lists, key, () => []).length; },
    async lRange(key, start, stop) { await tick(); return get(lists, key, () => []).slice(start, stop + 1); },
    async zAdd(key, { score, value }) { await tick(); get(zsets, key, () => new Map()).set(value, score); return 1; },
    async zRangeByScore(key, min, max) {
      await tick();
      return [...get(zsets, key, () => new Map())].filter(([, s]) => s >= min && s <= max).map(([v]) => v);
    },
    async zRem(key, value) { await tick(); return get(zsets, key, () => new Map()).delete(value) ? 1 : 0; },
    async hSet(key, field, value) { await tick(); get(hashes, key, () => new Map()).set(field, value); return 1; },
    async hGet(key, field) { await tick(); return get(hashes, key, () => new Map()).get(field) ?? null; },
    async hDel(key, field) { await tick(); return get(hashes, key, () => new Map()).delete(field) ? 1 : 0; },
    raw: async () => client,
  };
  return client;
}

function redisDriver(client, retryAfter = 90) {
  const app = {
    make: (name) => {
      if (name === 'redis') return { connection: () => client };
      return { get: (_key, fallback) => fallback };
    },
  };
  return new RedisDriver(app, { retryAfter });
}

const record = { queue: 'default', payload: '{}', maxAttempts: 3 };

test('redis driver re-queues a job whose reservation expired (worker crash)', async () => {
  const client = fakeRedis();
  const crashed = redisDriver(client, 0);
  await crashed.push(record);
  const first = await crashed.pop();
  assert.ok(first);

  const survivor = redisDriver(client, 90);
  const again = await survivor.pop();
  assert.equal(again?.id, first.id);
  assert.equal(again.attempts, 2);
});

test('redis driver delete clears the reservation', async () => {
  const client = fakeRedis();
  const driver = redisDriver(client, 0);
  await driver.push(record);
  const job = await driver.pop();
  await driver.delete(job.id);
  assert.equal(await driver.pop(), null);
  assert.equal(client.keysCalls, 0);
});

test('redis driver release after the reservation expired keeps the job exactly once', async () => {
  const client = fakeRedis();
  const driver = redisDriver(client, 0);
  await driver.push(record);
  const job = await driver.pop();

  await driver.pop('other'); // another worker's pop recovers the expired reservation
  await driver.release(job.id, 0);
  assert.equal(await driver.size(), 1);
});

test('redis driver release re-queues a live reservation', async () => {
  const client = fakeRedis();
  const driver = redisDriver(client, 90);
  await driver.push(record);
  const job = await driver.pop();
  await driver.release(job.id, 0);
  const retried = await driver.pop();
  assert.equal(retried?.id, job.id);
  assert.equal(retried.attempts, 2);
});

test('redis driver migrates a ready delayed job only once across workers', async () => {
  const client = fakeRedis();
  const a = redisDriver(client);
  const b = redisDriver(client);
  await a.push({ ...record, availableAt: new Date(Date.now() + 20).toISOString() });
  await new Promise((r) => setTimeout(r, 30));

  await Promise.all([a.size(), b.size()]);
  assert.equal(await a.size(), 1);
});
