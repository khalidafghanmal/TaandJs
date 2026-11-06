import test from 'node:test';
import assert from 'node:assert/strict';
import { Pipeline } from '../engine/middleware/Pipeline.js';
import { Middleware } from '../engine/middleware/Middleware.js';
import { ExceptionHandler } from '../engine/core/ExceptionHandler.js';
import { HttpError } from '../engine/http/HttpError.js';
import { LockoutRequests } from '../engine/middleware/LockoutRequests.js';
import { CacheManager } from '../engine/cache/CacheManager.js';
import { RateLimiter } from '../engine/http/RateLimiter.js';
import { ValidationError } from '../engine/validation/ValidationError.js';
import { miniApp, req, reqBody } from './helpers/setup.js';

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

async function flashedOld(config = {}) {
  const flashed = {};
  const session = { flash: (_s, key, value) => { flashed[key] = value; } };
  const { app } = miniApp({ session, config });
  const exceptions = new ExceptionHandler(app);
  const request = await reqBody('POST', '/register', {
    email: 'a@b.c',
    password: 'hunter2',
    password_confirmation: 'hunter2',
    current_password: 'old-secret',
  }, 'application/x-www-form-urlencoded');
  request.setAttribute('_session', {});

  const response = await exceptions.render(new ValidationError({ email: ['taken'] }), request);
  assert.equal(response.status, 302);
  return flashed.old;
}

test('ExceptionHandler does not flash passwords into the session on validation failure', async () => {
  assert.deepEqual(await flashedOld(), { email: 'a@b.c' });
});

test('ExceptionHandler dontFlash list is configurable', async () => {
  const old = await flashedOld({ validation: { dontFlash: ['email'] } });
  assert.deepEqual(old, { password: 'hunter2', password_confirmation: 'hunter2', current_password: 'old-secret' });
});
