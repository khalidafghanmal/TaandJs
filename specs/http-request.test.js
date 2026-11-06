import test from 'node:test';
import assert from 'node:assert/strict';
import { Request } from '../engine/http/Request.js';
import { ValidatePostSize } from '../engine/middleware/global/ValidatePostSize.js';
import { Response } from '../engine/http/Response.js';
import { req, reqBody, miniApp } from './helpers/setup.js';

test('request path from url', () => {
  assert.equal(req('/users?page=1').path, '/users');
});

test('request query parsed', () => {
  assert.deepEqual(req('/search?q=hello&page=2').query, { q: 'hello', page: '2' });
});

test('request params accessible', () => {
  assert.equal(req('/users/5', { params: { id: '5' } }).params.id, '5');
});

test('request isMethod check', () => {
  assert.equal(req('/', { method: 'POST' }).isMethod('POST'), true);
  assert.equal(req('/').isMethod('POST'), false);
});

test('request header case insensitive', () => {
  const r = req('/', { headers: { 'x-custom': 'yes' } });
  assert.equal(r.header('x-custom'), 'yes');
});

test('request cookies parsed', () => {
  const r = req('/', { headers: { cookie: 'sid=abc; theme=dark' } });
  assert.deepEqual(r.cookies(), { sid: 'abc', theme: 'dark' });
});

test('request ip from attribute', () => {
  const r = req('/');
  r.setAttribute('_ip', '192.168.1.1');
  assert.equal(r.ip(), '192.168.1.1');
});

test('request ip fallback', () => {
  assert.equal(req('/').ip(), '127.0.0.1');
});

test('request input reads query', () => {
  assert.equal(req('/?name=Bob').input('name'), 'Bob');
});

test('request input reads params', () => {
  assert.equal(req('/users/1', { params: { id: '1' } }).input('id'), '1');
});

test('request input fallback', () => {
  assert.equal(req('/').input('missing', 'default'), 'default');
});

test('request json body parsed', async () => {
  const r = await reqBody('POST', '/', { email: 'a@b.c' });
  assert.deepEqual(r.json(), { email: 'a@b.c' });
});

test('request form body parsed', async () => {
  const r = await reqBody('POST', '/', { title: 'Hi' }, 'application/x-www-form-urlencoded');
  assert.deepEqual(r.form(), { title: 'Hi' });
});

test('request all merges sources', async () => {
  const r = await reqBody('POST', '/?q=1', { name: 'A' });
  const merged = r.withParams({ id: '9' }).all();
  assert.equal(merged.name, 'A');
  assert.equal(merged.q, '1');
  assert.equal(merged.id, '9');
});

test('request invalid json yields empty object', async () => {
  const chunks = [Buffer.from('{bad json')];
  const raw = {
    method: 'POST',
    url: '/',
    headers: { host: 'localhost', 'content-type': 'application/json' },
    on(ev, fn) {
      if (ev === 'data') chunks.forEach((c) => fn(c));
      if (ev === 'end') fn();
      return this;
    },
    destroy() {},
  };
  const r = await Request.from(raw);
  assert.deepEqual(r.json(), {});
});

test('request sanitize trims json strings', async () => {
  const r = await reqBody('POST', '/', { name: '  Jane  ' });
  r.sanitize();
  assert.equal(r.json().name, 'Jane');
});

test('request withParams preserves body', async () => {
  const r = await reqBody('POST', '/', { x: 1 });
  const next = r.withParams({ id: '2' });
  assert.equal(next.params.id, '2');
  assert.deepEqual(next.json(), { x: 1 });
});

test('request attribute get/set', () => {
  const r = req('/');
  r.setAttribute('user', { id: 1 });
  assert.deepEqual(r.attribute('user'), { id: 1 });
  assert.equal(r.attribute('none', false), false);
});

test('request GET has empty body', () => {
  assert.equal(req('/').body, '');
});

test('request input priority form over query', async () => {
  const r = await reqBody('POST', '/?name=query', { name: 'form' }, 'application/x-www-form-urlencoded');
  assert.equal(r.input('name'), 'form');
});

function streamRaw(chunks, headers = {}) {
  let destroyed = false;
  return {
    method: 'POST',
    url: '/upload',
    headers: { host: 'localhost', 'content-type': 'application/octet-stream', ...headers },
    on(ev, fn) {
      if (ev === 'data') chunks.forEach((c) => fn(c));
      if (ev === 'end') fn();
      return this;
    },
    destroy() { destroyed = true; },
    get destroyed() { return destroyed; },
  };
}

test('request body limit is configurable and allows uploads over 1 MiB', async () => {
  const twoMiB = Buffer.alloc(2 * 1024 * 1024, 1);
  const r = await Request.from(streamRaw([twoMiB]), { maxBodySize: 5 * 1024 * 1024 });
  assert.equal(r.rawBody.length, twoMiB.length);
});

test('request body over the limit rejects with 413 without destroying the socket', async () => {
  const raw = streamRaw([Buffer.alloc(600), Buffer.alloc(600)]);
  await assert.rejects(() => Request.from(raw, { maxBodySize: 1000 }), (err) => err.status === 413);
  assert.equal(raw.destroyed, false);
});

test('request body over the limit by content-length is rejected before reading', async () => {
  let read = false;
  const raw = streamRaw([], { 'content-length': '5000' });
  const on = raw.on;
  raw.on = (ev, fn) => { if (ev === 'data') read = true; return on.call(raw, ev, fn); };
  await assert.rejects(() => Request.from(raw, { maxBodySize: 1000 }), (err) => err.status === 413);
  assert.equal(read, false);
});

test('ValidatePostSize uses the configured server.maxBodySize', async () => {
  const { app } = miniApp({ config: { server: { maxBodySize: 4 * 1024 * 1024 } } });
  const mw = new ValidatePostSize(app);
  const ok = async () => Response.text('ok');
  const at = (bytes) => req('/upload', { method: 'POST', headers: { 'content-length': String(bytes) } });

  assert.equal((await mw.handle(at(2 * 1024 * 1024), ok)).status, 200);
  assert.equal((await mw.handle(at(5 * 1024 * 1024), ok)).status, 413);
});
