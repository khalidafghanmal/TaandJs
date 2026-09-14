import test from 'node:test';
import assert from 'node:assert/strict';
import { CacheManager } from '../engine/cache/CacheManager.js';
import { RateLimiter } from '../engine/http/RateLimiter.js';
import { app } from '../start/app.js';
import attempt, { tooMany, hit, clear, count, retryIn, remaining, key, ensure } from '../start/attempt.js';

function bindAttemptServices() {
  const config = app.make('config');
  config.merge({
    cache: {
      default: 'memory',
      prefix: 'attempt_test_',
      stores: {
        memory: { driver: 'memory', maxEntries: 100, maxBytes: 1024 * 1024 },
      },
    },
  });
  app.instance('cache', new CacheManager(app));
  app.instance('rateLimiter', new RateLimiter(app));
}

test('attempt.key normalizes email and includes ip', () => {
  assert.equal(key('  Admin@Test.COM ', '10.0.0.1'), 'attempt:admin@test.com|10.0.0.1');
});

test('attempt blocks after max hits', async () => {
  bindAttemptServices();
  const throttleKey = key('user@test.com', '127.0.0.1');

  assert.equal(await tooMany(throttleKey, 3), false);
  await hit(throttleKey, 60);
  await hit(throttleKey, 60);
  assert.equal(await count(throttleKey), 2);
  assert.equal(await remaining(throttleKey, 3), 1);

  await hit(throttleKey, 60);
  assert.equal(await tooMany(throttleKey, 3), true);
  assert.equal(await remaining(throttleKey, 3), 0);
});

test('attempt.clear resets counter', async () => {
  bindAttemptServices();
  const throttleKey = key('reset@test.com', '1.2.3.4');

  await hit(throttleKey, 60);
  await hit(throttleKey, 60);
  await hit(throttleKey, 60);
  assert.equal(await tooMany(throttleKey, 3), true);

  await clear(throttleKey);
  assert.equal(await count(throttleKey), 0);
  assert.equal(await tooMany(throttleKey, 3), false);
});

test('attempt.ensure throws 429 when locked', async () => {
  bindAttemptServices();
  const throttleKey = key('locked@test.com', '9.9.9.9');

  await hit(throttleKey, 120);
  await hit(throttleKey, 120);

  await assert.rejects(
    () => ensure(throttleKey, 2, 120),
    (err) => err.status === 429 && err.code === 'TOO_MANY_REQUESTS',
  );
});

test('attempt.retryIn returns decay when blocked', async () => {
  bindAttemptServices();
  const throttleKey = key('retry@test.com', '8.8.8.8');

  await hit(throttleKey, 90);
  await hit(throttleKey, 90);
  const seconds = await retryIn(throttleKey, 90);
  assert.ok(seconds > 0);
});

test('attempt default export exposes all methods', () => {
  assert.equal(typeof attempt.tooMany, 'function');
  assert.equal(typeof attempt.hit, 'function');
  assert.equal(typeof attempt.clear, 'function');
  assert.equal(typeof attempt.keyFromRequest, 'function');
});
