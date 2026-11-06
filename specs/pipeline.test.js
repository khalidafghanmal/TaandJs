import test from 'node:test';
import assert from 'node:assert/strict';
import { Pipeline } from '../engine/middleware/Pipeline.js';
import { Middleware } from '../engine/middleware/Middleware.js';
import { ExceptionHandler } from '../engine/core/ExceptionHandler.js';
import { HttpError } from '../engine/http/HttpError.js';
import { LockoutRequests } from '../engine/middleware/LockoutRequests.js';
import { CacheManager } from '../engine/cache/CacheManager.js';
import { RateLimiter } from '../engine/http/RateLimiter.js';
import { miniApp, req } from './helpers/setup.js';

test('Pipeline rethrows when exceptions handler is missing', async () => {
  const { pipeline } = miniApp();

  await assert.rejects(
    () => pipeline.send({ setAttribute() {} }, [], async () => {
      throw new Error('boom');
    }),
    /boom/,
  );
});

test('Pipeline renders handler errors and runs terminate', async () => {
  let terminated = false;

  class RecordingMiddleware extends Middleware {
    async handle(request, next) {
      return next(request);
    }

    async terminate() {
      terminated = true;
    }
  }

  const { pipeline, middleware, app } = miniApp();
  const exceptions = new ExceptionHandler(app);
  const baseMake = app.make.bind(app);
  const baseHas = app.has.bind(app);
  app.make = (name) => (name === 'exceptions' ? exceptions : baseMake(name));
  app.has = (name) => name === 'exceptions' || baseHas(name);
  middleware.register('record', RecordingMiddleware);

  const { response, terminate } = await pipeline.send(req(), ['record'], async () => {
    throw HttpError.tooManyRequests('nope');
  });

  assert.equal(response.status, 429);
  await terminate();
  assert.equal(terminated, true);
});

test('Pipeline still runs terminate on success', async () => {
  let terminated = false;

  class RecordingMiddleware extends Middleware {
    async handle(request, next) {
      return next(request);
    }

    async terminate() {
      terminated = true;
    }
  }

  const { pipeline, middleware } = miniApp();
  middleware.register('record', RecordingMiddleware);

  const { terminate } = await pipeline.send({ setAttribute() {} }, ['record'], async () => {
    const { Response } = await import('../engine/http/Response.js');
    return new Response('ok');
  });

  await terminate();
  assert.equal(terminated, true);
});

test('ExceptionHandler hides 5xx error messages when debug is off', async () => {
  const { app } = miniApp();
  const exceptions = new ExceptionHandler(app);
  const secret = 'connect ECONNREFUSED db.internal:5432 user=taand';

  const json = await exceptions.render(new Error(secret), req('/api/users'));
  assert.equal(json.status, 500);
  assert.match(json.headers['Content-Type'], /json/);
  assert.doesNotMatch(json.body, /ECONNREFUSED/);

  const html = await exceptions.render(Object.assign(new Error(secret), { status: 503 }), req('/'));
  assert.equal(html.status, 503);
  assert.match(html.headers['Content-Type'], /html/);
  assert.doesNotMatch(html.body, /ECONNREFUSED/);

  const odd = await exceptions.render(Object.assign(new Error(secret), { status: 200 }), req('/api/x'));
  assert.equal(odd.status, 500);
  assert.doesNotMatch(odd.body, /ECONNREFUSED/);

  const notFound = await exceptions.render(HttpError.notFound('No such post'), req('/api/posts/9'));
  assert.equal(notFound.status, 404);
  assert.match(notFound.body, /No such post/);
});

test('ExceptionHandler keeps 5xx error messages when debug is on', async () => {
  const { app } = miniApp({ handlers: { log: { error() {}, warning() {} } } });
  app.debug = true;
  const exceptions = new ExceptionHandler(app);

  const response = await exceptions.render(new Error('db exploded'), req('/api/users'));
  assert.equal(response.status, 500);
  assert.match(response.body, /db exploded/);
});
