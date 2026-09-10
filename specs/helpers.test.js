import test from 'node:test';
import assert from 'node:assert/strict';
import { TaandCompiler } from '../engine/view/TaandCompiler.js';
import go from '../start/go.js';
import fail from '../start/fail.js';
import reply from '../start/reply.js';
import { bag } from '../start/bag.js';
import { text, Text } from '../start/text.js';
import { none, some, maybe } from '../start/value.js';
import { tick, today } from '../start/tick.js';
import { peek, halt, HaltError } from '../start/debug.js';
import { prevFromOld } from '../start/prev.js';
import { env } from '../start/env.js';
import { HttpError } from '../engine/http/HttpError.js';
import { Redirect } from '../engine/http/Redirect.js';
import { RouteRegistrar } from '../engine/routing/RouteRegistrar.js';
import { miniApp } from './helpers/setup.js';
import pass from '../start/pass.js';

test('env returns fallback for missing keys', () => {
  const key = `TAAND_TEST_MISSING_${Date.now()}`;
  assert.equal(env(key, 'fallback'), 'fallback');
});

test('bag filters and plucks', () => {
  const users = bag([
    { id: 1, email: 'a@test.com' },
    { id: 2, email: 'b@test.com' },
  ]);

  assert.deepEqual(users.filter((u) => u.id > 1).pluck('email'), ['b@test.com']);
  assert.equal(users.count(), 2);
});

test('text slug and limit', () => {
  assert.equal(String(text('Hello World!').slug()), 'hello-world');
  assert.equal(String(text('abcdefghij').limit(5)), 'abcde...');
});

test('none and some detect empty values', () => {
  assert.equal(none(''), true);
  assert.equal(none([]), true);
  assert.equal(some('ok'), true);
  assert.equal(maybe({ name: 'Ada' }).get('name'), 'Ada');
  assert.equal(maybe(null).or('guest'), 'guest');
});

test('tick adds days', () => {
  const start = tick('2026-01-01T00:00:00.000Z');
  const next = start.addDays(7);
  assert.equal(next.toISO().slice(0, 10), '2026-01-08');
  assert.equal(today().toDate().getHours(), 0);
});

test('reply builds json response', () => {
  const res = reply.json({ ok: true }, 201);
  assert.equal(res.status, 201);
  assert.deepEqual(JSON.parse(res.body), { ok: true });
});

test('go returns redirect', () => {
  const redirect = go('/dashboard', 301);
  assert.ok(redirect instanceof Redirect);
  assert.equal(redirect.url, '/dashboard');
  assert.equal(redirect.status, 301);
});

test('go.path redirects to named route', () => {
  const { router } = miniApp();
  router.get('/users/{id}', () => 'ok').name('users.show');
  const registrar = new RouteRegistrar(router);
  const url = registrar.url('users.show', { id: 42 });
  assert.equal(url, '/users/42');
});

test('fail throws HttpError', () => {
  assert.throws(() => fail(404), HttpError);
  try {
    fail(403, 'Nope');
  } catch (err) {
    assert.equal(err.status, 403);
    assert.equal(err.message, 'Nope');
  }
});

test('prevFromOld reads keyed input', () => {
  assert.equal(prevFromOld({ email: 'a@test.com' }, 'email'), 'a@test.com');
  assert.equal(prevFromOld({}, 'email', 'x'), 'x');
});

test('peek returns value without throwing', () => {
  const before = process.env.TAAND_DEBUG;
  process.env.TAAND_DEBUG = 'false';
  assert.deepEqual(peek({ a: 1 }), { a: 1 });
  process.env.TAAND_DEBUG = before;
});

test('halt throws HaltError when debug enabled', () => {
  const before = process.env.TAAND_DEBUG;
  process.env.TAAND_DEBUG = 'true';
  assert.throws(() => halt({ stop: true }), HaltError);
  process.env.TAAND_DEBUG = before;
});

test('halt blocked when debug disabled', () => {
  const before = process.env.TAAND_DEBUG;
  process.env.TAAND_DEBUG = 'false';
  assert.throws(() => halt('nope'), /TAAND_DEBUG/);
  process.env.TAAND_DEBUG = before;
});

test('compiler allows cfg path prev peek text helpers', () => {
  const compiler = new TaandCompiler();
  const { code } = compiler.compile("{{ cfg('app.name') }} {{ path('home') }} {{ prev('email') }} {{ peek('x') }}");
  assert.match(code, /__helpers\.cfg\('app\.name'\)/);
  assert.match(code, /__helpers\.path\('home'\)/);
  assert.match(code, /__helpers\.prev\('email'\)/);
  assert.match(code, /__helpers\.peek\('x'\)/);
});

test('uuid returns RFC4122 format', async () => {
  const { uuid } = await import('../start/uuid.js');
  assert.match(uuid(), /^[0-9a-f-]{36}$/i);
});

test('token returns secure string with minimum entropy', async () => {
  const { token } = await import('../start/token.js');
  const value = token(16);
  assert.ok(value.length >= 16);
  assert.throws(() => token(8), /at least 16 bytes/);
});

test('user reads request attribute', async () => {
  const user = (await import('../start/user.js')).default;
  const { runWithRequest } = await import('../engine/support/RequestContext.js');
  const request = { attribute(name) { return name === '_user' ? { id: 1, role: 'user' } : null; } };
  assert.equal(user(request)?.id, 1);
  runWithRequest(request, () => {
    assert.equal(user()?.id, 1);
  });
  assert.equal(user(), null);
});

test('back uses same-origin referer only', async () => {
  const back = (await import('../start/back.js')).default;
  const request = {
    header(name) {
      if (name === 'referer') return 'http://evil.com/steal';
      if (name === 'host') return 'localhost';
      return undefined;
    },
  };
  assert.equal(back(request, '/safe').url, '/safe');
});

test('appUrl rejects absolute path input', async () => {
  const { appUrl } = await import('../engine/support/AppUrl.js');
  assert.throws(() => appUrl('https://evil.com', 'http://localhost:2977/'), /rejects absolute/);
  assert.equal(appUrl('/dashboard', 'http://localhost:2977'), 'http://localhost:2977/dashboard');
});

test('tap returns original value', async () => {
  const tap = (await import('../start/tap.js')).default;
  let seen = null;
  assert.equal(tap(5, (v) => { seen = v; }), 5);
  assert.equal(seen, 5);
});

test('when and unless pick values', async () => {
  const { when, unless } = await import('../start/when.js');
  assert.equal(when(true, 'yes', 'no'), 'yes');
  assert.equal(unless(true, 'yes', 'no'), 'no');
});

test('e escapes html', async () => {
  const e = (await import('../start/e.js')).default;
  assert.equal(e('<script>'), '&lt;script&gt;');
});

test('bag groupBy keyBy unique sortBy flatten where', () => {
  const items = bag([
    { role: 'admin', id: 1 },
    { role: 'user', id: 2 },
    { role: 'admin', id: 3 },
  ]);
  assert.equal(items.groupBy('role').count(), 2);
  assert.equal(items.keyBy('id').firstWhere('id', 2)?.role, 'user');
  assert.equal(items.unique('role').count(), 2);
  assert.equal(items.sortBy('id').last()?.id, 3);
  assert.equal(items.flatten().count(), 3);
  assert.equal(items.where('role', 'admin').count(), 2);
});

test('bag ignores unsafe keys', () => {
  const payload = JSON.parse('{"__proto__":{"polluted":true},"name":"ok"}');
  assert.deepEqual(bag([payload]).pluck('__proto__'), [null]);
});

test('text contains mask and secure random', () => {
  assert.equal(text('hello world').contains('world'), true);
  const masked = String(text('secret@test.com').mask('email'));
  assert.match(masked, /^s\*{3}@test\.com$/);
  assert.notEqual(String(Text.random(24)), String(Text.random(24)));
});

test('maybe chains when unless tap value', () => {
  assert.equal(maybe({ n: 2 }).when((v) => v.n > 1, (v) => v.n * 2), 4);
  assert.equal(maybe(null).unless(false, 'fallback'), 'fallback');
  let tapped = false;
  maybe({ ok: true }).tap(() => { tapped = true; });
  assert.equal(tapped, true);
});

test('classNames sanitizes invalid tokens', async () => {
  const { classNames } = await import('../engine/support/ViewForm.js');
  assert.equal(classNames({ active: true, 'bad class': true }), 'active');
  assert.equal(classNames('btn primary'), 'btn primary');
});

test('formErrorsFromFlash returns first message', async () => {
  const { formErrorsFromFlash } = await import('../engine/support/FormErrors.js');
  const msg = formErrorsFromFlash({ errors: { email: ['Invalid email', 'Required'] } }, 'email');
  assert.equal(msg, 'Invalid email');
});

test('pass strips sensitive fields for views', () => {
  const user = {
    id: 1,
    name: 'Jane',
    email: 'jane@test.com',
    passwordHash: 'secret-hash',
    rememberToken: 'tok',
  };

  assert.deepEqual(pass({ user, title: 'Hello' }), {
    user: { id: 1, name: 'Jane', email: 'jane@test.com' },
    title: 'Hello',
  });
});

test('pass supports per-key only lists', () => {
  const user = { id: 1, name: 'Jane', email: 'jane@test.com', role: 'admin' };
  assert.deepEqual(pass({ user }, { keys: { user: ['id', 'name'] } }), {
    user: { id: 1, name: 'Jane' },
  });
});

test('pass blocks unsafe keys and invalid input', () => {
  const payload = JSON.parse('{"__proto__":{"x":1},"title":"ok"}');
  assert.deepEqual(pass(payload), { title: 'ok' });
  assert.throws(() => pass(null), /plain object/);
  assert.throws(() => pass(['x']), /plain object/);
});

test('pass serializes dates and nested arrays', () => {
  const createdAt = new Date('2026-01-01T00:00:00.000Z');
  const out = pass({
    posts: [{ id: 1, title: 'A', password: 'nope' }],
    createdAt,
  });
  assert.equal(out.createdAt, '2026-01-01T00:00:00.000Z');
  assert.deepEqual(out.posts, [{ id: 1, title: 'A' }]);
});
