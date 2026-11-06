import test from 'node:test';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { Redirect } from '../engine/http/Redirect.js';
import { Response } from '../engine/http/Response.js';
import { SecurityHeaders } from '../engine/middleware/global/SecurityHeaders.js';
import { ThrottleRequests } from '../engine/middleware/ThrottleRequests.js';
import { CsrfProtection } from '../engine/middleware/web/CsrfProtection.js';
import { miniApp, req, reqBody } from './helpers/setup.js';

test('Redirect blocks open redirect http', () => {
  assert.throws(() => Redirect.to('http://evil.com'), /relative path/);
});

test('Redirect blocks protocol-relative', () => {
  assert.throws(() => Redirect.to('//evil.com'), /relative path/);
});

test('Redirect blocks path traversal', () => {
  assert.throws(() => Redirect.to('/../admin'), /Invalid redirect/);
});

test('Redirect blocks backslash', () => {
  assert.throws(() => Redirect.to('/path\\evil'), /Invalid redirect/);
});

test('Redirect allows safe relative path', () => {
  const r = Redirect.to('/dashboard');
  assert.equal(r.url, '/dashboard');
  assert.equal(r.toResponse().status, 302);
});

test('Response json sets content type', () => {
  const r = Response.json({ ok: true });
  assert.match(r.headers['Content-Type'], /json/);
  assert.deepEqual(JSON.parse(r.body), { ok: true });
});

test('Response security headers on html', () => {
  const r = Response.html('<p>x</p>');
  assert.equal(r.headers['X-Content-Type-Options'], 'nosniff');
  assert.equal(r.headers['X-Frame-Options'], 'DENY');
});

test('SecurityHeaders adds CSP on terminate', async () => {
  const { app } = miniApp();
  const mw = new SecurityHeaders(app);
  const response = Response.text('ok');
  await mw.terminate(req(), response);
  assert.match(response.headers['Content-Security-Policy'], /default-src 'self'/);
  assert.equal(response.headers['Cross-Origin-Opener-Policy'], 'same-origin');
});

test('ThrottleRequests blocks after max attempts', async () => {
  const { app } = miniApp();
  const mw = new ThrottleRequests(app, 2, 1);
  const request = req('/login', { ip: '10.0.0.1' });
  const next = async () => Response.text('ok');

  await mw.handle(request, next);
  await mw.handle(request, next);
  const blocked = await mw.handle(request, next);
  assert.equal(blocked.status, 429);
});

test('ThrottleRequests sets rate limit headers', async () => {
  const { app } = miniApp();
  const mw = new ThrottleRequests(app, 5, 1);
  const request = req('/api', { ip: '10.0.0.2' });
  const res = await mw.handle(request, async () => Response.text('ok'));
  await mw.terminate(request, res);
  assert.equal(res.headers['X-RateLimit-Limit'], '5');
});

test('CsrfProtection rejects POST without token', async () => {
  const sessions = {
    store: { _csrf: 'abc123' },
    get(_s, key) { return this.store[key]; },
    put(_s, key, val) { this.store[key] = val; },
  };
  const { app } = miniApp({
    session: sessions,
  });
  const mw = new CsrfProtection(app);
  const request = req('/form', { method: 'POST' });
  request.setAttribute('_session', 'sess1');
  const res = await mw.handle(request, async () => Response.text('ok'));
  assert.equal(res.status, 419);
});

test('CsrfProtection accepts matching token', async () => {
  const token = 'tokensecret123456789012345678901234567890';
  const sessions = {
    store: { _csrf: token },
    get(_s, key) { return this.store[key]; },
    put(_s, key, val) { this.store[key] = val; },
  };
  const { app } = miniApp({ session: sessions });
  const mw = new CsrfProtection(app);
  const request = await reqBody(
    'POST',
    '/form',
    { _token: token },
    'application/x-www-form-urlencoded',
    { cookie: `XSRF-TOKEN=${token}` },
  );
  request.setAttribute('_session', 'sess1');
  let passed = false;
  await mw.handle(request, async () => {
    passed = true;
    return Response.text('ok');
  });
  assert.equal(passed, true);
});

test('CsrfProtection skips GET requests', async () => {
  const { app } = miniApp();
  const mw = new CsrfProtection(app);
  let passed = false;
  await mw.handle(req('/page'), async () => {
    passed = true;
    return Response.text('ok');
  });
  assert.equal(passed, true);
});

test('Response notFound status 404', () => {
  assert.equal(Response.notFound().status, 404);
});

test('Response methodNotAllowed includes Allow', () => {
  const r = Response.methodNotAllowed(['GET', 'POST']);
  assert.equal(r.status, 405);
  assert.equal(r.headers.Allow, 'GET, POST');
});

test('Response appendCookie merges Set-Cookie', () => {
  const r = Response.text('');
  Response.appendCookie(r, 'a=1');
  Response.appendCookie(r, 'b=2');
  assert.equal(r.headers['Set-Cookie'].length, 2);
});

test('Redirect sanitize is used by constructor', () => {
  assert.throws(() => new Redirect('https://x.com'), /relative path/);
});

test('Response error helper', () => {
  assert.equal(Response.error('fail', 500).status, 500);
});

test('HandleCors preflight returns 204 with headers', async () => {
  const { HandleCors } = await import('../engine/middleware/global/HandleCors.js');
  const { app } = miniApp({
    config: {
      cors: {
        enabled: true,
        paths: ['api/*'],
        allowedOrigins: ['http://localhost:3000'],
        allowedMethods: ['GET', 'POST', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization'],
        exposedHeaders: [],
        maxAge: 600,
        supportsCredentials: false,
      },
    },
  });
  const mw = new HandleCors(app);
  const request = req('/api/users', { method: 'OPTIONS', headers: { origin: 'http://localhost:3000' } });
  const response = await mw.handle(request, async () => Response.text('skipped'));
  assert.equal(response.status, 204);
  assert.equal(response.headers['Access-Control-Allow-Origin'], 'http://localhost:3000');
  assert.match(response.headers['Access-Control-Allow-Methods'], /GET/);
});

test('HandleCors adds headers on terminate for api routes', async () => {
  const { HandleCors } = await import('../engine/middleware/global/HandleCors.js');
  const { app } = miniApp({
    config: {
      cors: {
        enabled: true,
        paths: ['api/*'],
        allowedOrigins: ['*'],
        allowedMethods: ['GET'],
        allowedHeaders: ['Content-Type'],
        exposedHeaders: [],
        maxAge: 0,
        supportsCredentials: false,
      },
    },
  });
  const mw = new HandleCors(app);
  const request = req('/api/ping', { headers: { origin: 'http://example.com' } });
  const response = await mw.handle(request, async () => Response.json({ ok: true }));
  await mw.terminate(request, response);
  assert.equal(response.headers['Access-Control-Allow-Origin'], '*');
});

test('HandleCors skips non-matching paths', async () => {
  const { HandleCors } = await import('../engine/middleware/global/HandleCors.js');
  const { app } = miniApp({
    config: {
      cors: {
        enabled: true,
        paths: ['api/*'],
        allowedOrigins: ['*'],
        allowedMethods: ['GET'],
        allowedHeaders: [],
        exposedHeaders: [],
        maxAge: 0,
        supportsCredentials: false,
      },
    },
  });
  const mw = new HandleCors(app);
  const request = req('/dashboard');
  const response = await mw.handle(request, async () => Response.text('ok'));
  await mw.terminate(request, response);
  assert.equal(response.headers['Access-Control-Allow-Origin'], undefined);
});

test('HandleCors does not reflect Origin when * + credentials', async () => {
  const { HandleCors } = await import('../engine/middleware/global/HandleCors.js');
  const { app } = miniApp({
    config: {
      cors: {
        enabled: true,
        paths: ['api/*'],
        allowedOrigins: ['*'],
        allowedMethods: ['GET'],
        allowedHeaders: ['Content-Type'],
        exposedHeaders: [],
        maxAge: 0,
        supportsCredentials: true,
      },
    },
  });
  const mw = new HandleCors(app);
  const request = req('/api/ping', { headers: { origin: 'https://evil.example' } });
  const response = await mw.handle(request, async () => Response.json({ ok: true }));
  await mw.terminate(request, response);
  assert.equal(response.headers['Access-Control-Allow-Origin'], undefined);
  assert.equal(response.headers['Access-Control-Allow-Credentials'], undefined);
});

test('safeBackPath blocks external referer', async () => {
  const { safeBackPath } = await import('../engine/support/SafeBack.js');
  const request = {
    header(name) {
      if (name === 'referer') return 'http://evil.com/phish';
      if (name === 'host') return 'localhost';
      return undefined;
    },
  };
  assert.equal(safeBackPath(request, '/fallback'), '/fallback');
});

test('safeBackPath allows same-host referer pathname', async () => {
  const { safeBackPath } = await import('../engine/support/SafeBack.js');
  const request = {
    header(name) {
      if (name === 'referer') return 'http://localhost:2977/form?x=1';
      if (name === 'host') return 'localhost:2977';
      return undefined;
    },
  };
  assert.equal(safeBackPath(request, '/'), '/form?x=1');
});

test('safeBackPath blocks traversal in referer', async () => {
  const { safeBackPath } = await import('../engine/support/SafeBack.js');
  const request = {
    header(name) {
      if (name === 'referer') return 'http://localhost/admin/../secret';
      if (name === 'host') return 'localhost';
      return undefined;
    },
  };
  assert.equal(safeBackPath(request, '/safe'), '/safe');
});

test('can fails closed without authenticated user', async () => {
  const can = (await import('../start/can.js')).default;
  const { authorize } = await import('../start/can.js');
  assert.equal(await can('admin'), false);
  await assert.rejects(() => authorize('admin'), (err) => err.status === 403);
});

test('CsrfProtection compares tokens in constant time', async () => {
  const token = 'a'.repeat(64);
  const sessions = {
    store: { _csrf: token },
    get(_s, key) { return this.store[key]; },
    put(_s, key, val) { this.store[key] = val; },
  };
  const { app } = miniApp({ session: sessions });
  const mw = new CsrfProtection(app);

  const original = crypto.timingSafeEqual;
  let calls = 0;
  crypto.timingSafeEqual = (...args) => {
    calls++;
    return original(...args);
  };

  try {
    const forged = await reqBody(
      'POST',
      '/form',
      { _token: `${'a'.repeat(63)}b` },
      'application/x-www-form-urlencoded',
      { cookie: `XSRF-TOKEN=${'a'.repeat(63)}b` },
    );
    forged.setAttribute('_session', 'sess1');
    const res = await mw.handle(forged, async () => Response.text('ok'));
    assert.equal(res.status, 419);
    assert.ok(calls > 0, 'expected crypto.timingSafeEqual to be used');
  } finally {
    crypto.timingSafeEqual = original;
  }
});
