import test from 'node:test';
import assert from 'node:assert/strict';
import { Router } from '../engine/routing/Router.js';
import { Redirect } from '../engine/http/Redirect.js';
import { Route } from '../engine/routing/Route.js';
import { Middleware } from '../engine/middleware/Middleware.js';
import { miniApp, req, dispatch, body } from './helpers/setup.js';

function boot() {
  const { router } = miniApp();
  return router;
}

test('GET route returns handler result', async () => {
  const r = boot();
  r.get('/hello', () => ({ ok: true }));
  const res = await dispatch(r, req('/hello'));
  assert.equal(res.status, 200);
  assert.deepEqual(body(res), { ok: true });
});

test('POST route accepts mutating verb', async () => {
  const r = boot();
  r.post('/save', (q) => ({ method: q.method }));
  const res = await dispatch(r, req('/save', { method: 'POST' }));
  assert.deepEqual(body(res), { method: 'POST' });
});

test('route params inject into request', async () => {
  const r = boot();
  r.get('/users/{id}', (q) => ({ id: q.params.id }));
  const res = await dispatch(r, req('/users/42'));
  assert.deepEqual(body(res), { id: '42' });
});

test('where constraint rejects non-matching path', async () => {
  const r = boot();
  r.get('/items/{id}', () => 'ok').where('id', '\\d+');
  r.fallback(() => 'fallback');
  const bad = await dispatch(r, req('/items/abc'));
  assert.equal(bad.status, 200);
  assert.equal(body(bad), 'fallback');
});

test('where constraint accepts matching path', async () => {
  const r = boot();
  r.get('/items/{id}', (q) => ({ id: q.params.id })).where('id', '\\d+');
  const res = await dispatch(r, req('/items/99'));
  assert.deepEqual(body(res), { id: '99' });
});

test('named route url generation', () => {
  const r = boot();
  r.get('/posts/{slug}', () => {}).name('posts.show');
  assert.equal(r.url('posts.show', { slug: 'hello-world' }), '/posts/hello-world');
});

test('named route throws when param missing', () => {
  const r = boot();
  r.get('/posts/{slug}', () => {}).name('posts.show');
  assert.throws(() => r.url('posts.show', {}), /Missing parameters/);
});

test('route group applies prefix', async () => {
  const r = boot();
  r.group({ prefix: '/api' }, () => {
    r.get('/health', () => ({ up: true }));
  });
  const res = await dispatch(r, req('/api/health'));
  assert.deepEqual(body(res), { up: true });
});

test('route group stacks nested prefixes', async () => {
  const r = boot();
  r.group({ prefix: '/v1' }, () => {
    r.group({ prefix: '/users' }, () => {
      r.get('/', () => ({ nested: true }));
    });
  });
  const res = await dispatch(r, req('/v1/users'));
  assert.deepEqual(body(res), { nested: true });
});

test('route group applies name prefix', () => {
  const r = boot();
  r.group({ prefix: '/api', name: 'api' }, () => {
    r.get('/ping', () => {}).name('ping');
  });
  assert.equal(r.url('api.ping'), '/api/ping');
});

test('redirect route sends Location header', async () => {
  const r = boot();
  r.redirect('/old', '/new');
  const res = await dispatch(r, req('/old'));
  assert.equal(res.status, 302);
  assert.equal(res.headers.Location, '/new');
});

test('fallback handles unknown paths', async () => {
  const r = boot();
  r.fallback(() => 'not found custom');
  const res = await dispatch(r, req('/missing'));
  assert.equal(res.status, 200);
  assert.equal(body(res), 'not found custom');
});

test('404 when no route and no fallback', async () => {
  const r = boot();
  const res = await dispatch(r, req('/nope'));
  assert.equal(res.status, 404);
});

test('405 when method not allowed', async () => {
  const r = boot();
  r.get('/only-get', () => 'ok');
  const res = await dispatch(r, req('/only-get', { method: 'POST' }));
  assert.equal(res.status, 405);
  assert.match(res.headers.Allow, /GET/);
});

test('HEAD uses GET route', async () => {
  const r = boot();
  r.get('/page', () => 'html');
  const res = await dispatch(r, req('/page', { method: 'HEAD' }));
  assert.equal(res.status, 200);
});

test('match accepts multiple verbs', async () => {
  const r = boot();
  r.match(['GET', 'POST'], '/dual', (q) => ({ m: q.method }));
  const get = await dispatch(r, req('/dual'));
  const post = await dispatch(r, req('/dual', { method: 'POST' }));
  assert.equal(body(get).m, 'GET');
  assert.equal(body(post).m, 'POST');
});

test('any accepts DELETE on route', async () => {
  const r = boot();
  r.any('/hook', (q) => ({ m: q.method }));
  const res = await dispatch(r, req('/hook', { method: 'DELETE' }));
  assert.equal(body(res).m, 'DELETE');
});

test('string handler returns HTML', async () => {
  const r = boot();
  r.get('/html', () => '<p>Hi</p>');
  const res = await dispatch(r, req('/html'));
  assert.match(res.headers['Content-Type'], /html/);
  assert.equal(res.body, '<p>Hi</p>');
});

test('Redirect instance returned from handler', async () => {
  const r = boot();
  r.get('/go', () => Redirect.to('/home'));
  const res = await dispatch(r, req('/go'));
  assert.equal(res.status, 302);
  assert.equal(res.headers.Location, '/home');
});

test('router reset clears routes', async () => {
  const r = boot();
  r.get('/temp', () => 'x');
  r.reset();
  r.fallback(() => 'empty');
  const res = await dispatch(r, req('/temp'));
  assert.equal(body(res), 'empty');
});

test('Route.normalizeUri collapses slashes', () => {
  assert.equal(Route.normalizeUri('//foo///bar//'), '/foo/bar');
  assert.equal(Route.normalizeUri('/'), '/');
});

test('unsafe route pattern is rejected', () => {
  assert.throws(() => Route.compile('/x/{id}', { id: 'eval' }), /Unsafe route pattern/);
});

test('fluent middleware attaches to route', async () => {
  const log = [];
  const { router, middleware } = miniApp();
  middleware.register('test', class extends Middleware {
    async handle(request, next) {
      log.push('mw');
      return next(request);
    }
  });
  router.get('/mw', () => ({ ok: true })).middleware('test');
  await dispatch(router, req('/mw'));
  assert.deepEqual(log, ['mw']);
});

test('route url encodes special characters', () => {
  const r = boot();
  r.get('/search/{q}', () => {}).name('search');
  assert.equal(r.url('search', { q: 'a b' }), '/search/a%20b');
});

test('multiple dynamic routes match correct handler', async () => {
  const r = boot();
  r.get('/users/{id}', (q) => ({ type: 'user', id: q.params.id }));
  r.get('/posts/{id}', (q) => ({ type: 'post', id: q.params.id }));
  const u = await dispatch(r, req('/users/1'));
  const p = await dispatch(r, req('/posts/1'));
  assert.deepEqual(body(u), { type: 'user', id: '1' });
  assert.deepEqual(body(p), { type: 'post', id: '1' });
});

test('OPTIONS route responds', async () => {
  const r = boot();
  r.options('/api', () => ({ allow: true }));
  const res = await dispatch(r, req('/api', { method: 'OPTIONS' }));
  assert.deepEqual(body(res), { allow: true });
});

test('PUT and PATCH routes work', async () => {
  const r = boot();
  r.put('/r', (q) => ({ m: q.method }));
  r.patch('/r', (q) => ({ m: q.method }));
  assert.equal(body(await dispatch(r, req('/r', { method: 'PUT' }))).m, 'PUT');
  assert.equal(body(await dispatch(r, req('/r', { method: 'PATCH' }))).m, 'PATCH');
});

test('DELETE route works', async () => {
  const r = boot();
  r.delete('/r', (q) => ({ m: q.method }));
  assert.equal(body(await dispatch(r, req('/r', { method: 'DELETE' }))).m, 'DELETE');
});

test('invalid action type throws at registration', () => {
  const r = boot();
  assert.throws(() => r.get('/bad', null), /Route action must be/);
});

test('async handler is awaited', async () => {
  const r = boot();
  r.get('/async', async () => ({ async: true }));
  const res = await dispatch(r, req('/async'));
  assert.deepEqual(body(res), { async: true });
});

test('fluent withoutMiddleware skips middleware for that route', async () => {
  const log = [];
  const { router, middleware } = miniApp();
  middleware.register('test', class extends Middleware {
    async handle(request, next) {
      log.push('mw');
      return next(request);
    }
  });
  router.group({ middleware: ['test'] }, () => {
    router.get('/with', () => ({ ok: true }));
    router.get('/without', () => ({ ok: true })).withoutMiddleware('test');
  });

  await dispatch(router, req('/with'));
  const res = await dispatch(router, req('/without'));
  assert.equal(res.status, 200);
  assert.deepEqual(log, ['mw']);
});
