import test from 'node:test';
import assert from 'node:assert/strict';
import { CacheManager } from '../engine/cache/CacheManager.js';
import { RateLimiter } from '../engine/http/RateLimiter.js';
import { LockoutRequests } from '../engine/middleware/LockoutRequests.js';
import { Response } from '../engine/http/Response.js';
import { Container } from '../engine/core/Container.js';
import { Config } from '../engine/core/Config.js';
import { ErrorRenderer } from '../engine/http/ErrorRenderer.js';
import { ExceptionHandler } from '../engine/core/ExceptionHandler.js';
import { HttpError } from '../engine/http/HttpError.js';
import { MiddlewareRegistry } from '../engine/middleware/MiddlewareRegistry.js';
import { Pipeline } from '../engine/middleware/Pipeline.js';
import { req, reqBody } from './helpers/setup.js';

function lockoutApp(overrides = {}) {
  const app = Object.assign(new Container(), { basePath: process.cwd(), debug: false });
  const config = new Config();
  config.merge({
    cache: {
      default: 'memory',
      prefix: 'lockout_test_',
      stores: { memory: { driver: 'memory', maxEntries: 100, maxBytes: 1024 * 1024 } },
    },
    app: { debug: false, name: 'Test' },
    ...(overrides.config ?? {}),
  });

  app.instance('config', config);
  const cache = new CacheManager(app);
  const rateLimiter = new RateLimiter(app);
  const errors = new ErrorRenderer(app);
  app.instance('cache', cache);
  app.instance('rateLimiter', rateLimiter);
  app.instance('errors', errors);

  app.make = (name) => app.resolve(name);
  app.has = (name) => ['config', 'cache', 'rateLimiter', 'errors'].includes(name);

  return { app, cache, rateLimiter };
}

test('lockout blocks after max failed attempts', async () => {
  const { app } = lockoutApp();
  const mw = new LockoutRequests(app, 2, 1);
  const next = async () => new Response('', 302, { Location: '/login' });

  const request = await reqBody(
    'POST',
    '/login',
    { email: 'user@test.com', password: 'wrong' },
    'application/json',
    { accept: 'application/json' },
  );

  await mw.handle(request, next);
  await mw.terminate(request, await next());

  await mw.handle(request, next);
  await mw.terminate(request, await next());

  const blocked = await mw.handle(request, next);
  assert.equal(blocked.status, 429);
  assert.equal(blocked.headers['X-Lockout-Remaining'], '0');
});

test('lockout clears counter on successful redirect', async () => {
  const { app, rateLimiter } = lockoutApp();
  const mw = new LockoutRequests(app, 2, 1);
  const fail = async () => new Response('', 302, { Location: '/login' });
  const ok = async () => new Response('', 302, { Location: '/dashboard' });

  const request = await reqBody('POST', '/login', { email: 'ok@test.com', password: 'x' });

  await mw.handle(request, fail);
  await mw.terminate(request, await fail());

  await mw.handle(request, ok);
  await mw.terminate(request, await ok());

  const key = `attempt:ok@test.com|${request.ip()}`;
  assert.equal(await rateLimiter.attempts(key), 0);
});

test('lockout does not count successful json response', async () => {
  const { app, rateLimiter } = lockoutApp();
  const mw = new LockoutRequests(app, 2, 1);
  const request = await reqBody('POST', '/login', { email: 'api@test.com', password: 'x' });
  const ok = async () => Response.json({ token: 'abc' });

  await mw.handle(request, ok);
  await mw.terminate(request, await ok());

  const key = `attempt:api@test.com|${request.ip()}`;
  assert.equal(await rateLimiter.attempts(key), 0);
});

test('lockout withParams parses route string', () => {
  const { app } = lockoutApp();
  const mw = LockoutRequests.withParams(app, ['3', '5', 'username']);
  assert.equal(mw.maxAttempts, 3);
  assert.equal(mw.decaySeconds, 300);
  assert.equal(mw.identityField, 'username');
});

test('lockout counts thrown 401 from controller', async () => {
  const { app, rateLimiter } = lockoutApp();
  app.instance('exceptions', new ExceptionHandler(app));
  const middleware = new MiddlewareRegistry();
  middleware.register('lockout', LockoutRequests);
  app.instance('middleware', middleware);
  app.has = (name) => ['config', 'cache', 'rateLimiter', 'errors', 'exceptions', 'middleware'].includes(name);

  const pipe = new Pipeline(app);
  const request = await reqBody('POST', '/login', { email: 'throw@test.com', password: 'x' });
  const fail = async () => {
    throw new HttpError('Invalid credentials', 401);
  };

  const { response: r1, terminate: t1 } = await pipe.send(request, ['lockout:2,1'], fail);
  await t1();
  assert.equal(r1.status, 401);

  const { response: r2, terminate: t2 } = await pipe.send(request, ['lockout:2,1'], fail);
  await t2();
  assert.equal(r2.status, 401);

  const { response: blocked } = await pipe.send(request, ['lockout:2,1'], fail);
  assert.equal(blocked.status, 429);
  assert.equal(await rateLimiter.attempts('attempt:throw@test.com|127.0.0.1'), 2);
});

test('lockout in-memory fallback blocks without redis', async () => {
  const app = Object.assign(new Container(), { basePath: process.cwd() });
  const config = new Config();
  config.merge({ app: { debug: false, name: 'Test' } });
  app.instance('config', config);
  app.instance('errors', new ErrorRenderer(app));
  app.make = (name) => app.resolve(name);
  app.has = () => false;

  const mw = new LockoutRequests(app, 2, 1);
  const fail = async () => new Response('', 302, { Location: '/login' });
  const request = await reqBody('POST', '/login', { email: 'mem@test.com', password: 'x' });

  await mw.handle(request, fail);
  await mw.terminate(request, await fail());
  await mw.handle(request, fail);
  await mw.terminate(request, await fail());

  const blocked = await mw.handle(request, fail);
  assert.equal(blocked.status, 429);
});
