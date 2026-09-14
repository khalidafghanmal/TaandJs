import test from 'node:test';
import assert from 'node:assert/strict';
import { escapeHtml } from '../engine/view/escape.js';
import { TaandCompiler } from '../engine/view/TaandCompiler.js';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { ViewEngine } from '../engine/view/ViewEngine.js';
import { Container } from '../engine/core/Container.js';

const compiler = new TaandCompiler();

test('escapeHtml encodes dangerous characters', () => {
  assert.equal(escapeHtml('<script>'), '&lt;script&gt;');
  assert.equal(escapeHtml('"'), '&quot;');
  assert.equal(escapeHtml("'"), '&#39;');
  assert.equal(escapeHtml('&'), '&amp;');
});

test('escapeHtml null becomes empty', () => {
  assert.equal(escapeHtml(null), '');
  assert.equal(escapeHtml(undefined), '');
});

test('compiler outputs {{ }} escaped binding', () => {
  const { code } = compiler.compile('<p>{{ $name }}</p>');
  assert.match(code, /__e\(/);
  assert.match(code, /__out \+=/);
});

test('compiler @if directive', () => {
  const { code } = compiler.compile('@if ($ok)\n<p>yes</p>\n@end');
  assert.match(code, /if\s*\(/);
});

test('compiler @each loop', () => {
  const { code } = compiler.compile('@each $item in $items\n<li>{{ $item }}</li>\n@end');
  assert.match(code, /__helpers\.iterate/);
});

test('compiler detects layout', () => {
  const { layout } = compiler.compile("@t-layout('layouts.app')\n<h1>Hi</h1>");
  assert.equal(layout, 'layouts.app');
});

test('compiler standalone has no layout', () => {
  const { layout } = compiler.compile('<h1>Hi</h1>');
  assert.equal(layout, null);
});

test('compiler raw {! !} skips escape', () => {
  const { code } = compiler.compile('<div>{! $html !}</div>');
  assert.match(code, /String\(/);
});

test('ViewEngine renders simple template', async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'taand-view-'));
  const views = path.join(tmp, 'views');
  const cache = path.join(tmp, 'cache');
  fs.mkdirSync(views, { recursive: true });
  fs.writeFileSync(path.join(views, 'hello.taand'), '<p>Hello {{ $name }}</p>');

  const app = Object.assign(new Container(), { debug: false, make: () => null, has: () => false });
  const engine = new ViewEngine(app);
  engine.configure({ viewsPath: views, cachePath: cache, cacheEnabled: false });

  const html = await engine.render('hello', { name: 'World' });
  assert.match(html, /Hello World/);
  fs.rmSync(tmp, { recursive: true, force: true });
});

test('ViewEngine escapes XSS in variables', async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'taand-xss-'));
  const views = path.join(tmp, 'views');
  const cache = path.join(tmp, 'cache');
  fs.mkdirSync(views, { recursive: true });
  fs.writeFileSync(path.join(views, 'x.taand'), '<p>{{ $name }}</p>');

  const app = Object.assign(new Container(), { debug: false, make: () => null, has: () => false });
  const engine = new ViewEngine(app);
  engine.configure({ viewsPath: views, cachePath: cache, cacheEnabled: false });

  const html = await engine.render('x', { name: '<img onerror=alert(1)>' });
  assert.doesNotMatch(html, /<img onerror/);
  assert.match(html, /&lt;img/);
  fs.rmSync(tmp, { recursive: true, force: true });
});

test('compiler @else branch', () => {
  const { code } = compiler.compile('@if ($x)\na\n@else\nb\n@end');
  assert.match(code, /else/);
});

test('DirectiveNormalizer unified @end', () => {
  const { code } = compiler.compile('@if ($a)\n1\n@end');
  assert.doesNotMatch(code, /@end/);
});

test('compiler partial via @include', () => {
  const { code } = compiler.compile('@include nav');
  assert.match(code, /__helpers\.partial\("nav"/);
});

test('compiler allows view helpers including peek and text', () => {
  const { code } = compiler.compile("{{ peek('hello') }} {{ text($title).slug() }}");
  assert.match(code, /__helpers\.peek\('hello'\)/);
  assert.match(code, /__helpers\.text\(__data\.title\)\.slug\(\)/);
});

test('compiler allows none and some in conditions', () => {
  const { code } = compiler.compile('@if (some($email))\nok\n@end');
  assert.match(code, /__helpers\.some\(__data\.email\)/);
  assert.doesNotMatch(code, /if \(__helpers\.some\(__data\.email\) \{/);
  assert.match(code, /if \(__helpers\.some\(__data\.email\)\) \{/);
});

test('compiler handles some() without wrapping parens', () => {
  const { code } = compiler.compile('@if some($_errors.email)\n<p>err</p>\n@end');
  assert.match(code, /if \(__helpers\.some\(__data\._errors\.email\)\) \{/);
});

test('compiler renders csrf_field as raw HTML', () => {
  const { code } = compiler.compile('<form>{{ csrf_field() }}</form>');
  assert.match(code, /__out \+= String\(__helpers\.csrf_field\(\)/);
  assert.doesNotMatch(code, /__e\(__helpers\.csrf_field/);
});

test('DirectiveNormalizer parses @if with parentheses', () => {
  const { code } = compiler.compile('@if($hint)\n<p>tip</p>\n@end');
  assert.match(code, /if \(__data\.hint\)/);
});

test('ViewEngine renders peek and text helpers', async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'taand-view-helpers-'));
  const views = path.join(tmp, 'views');
  const cache = path.join(tmp, 'cache');
  fs.mkdirSync(views, { recursive: true });
  fs.writeFileSync(
    path.join(views, 'helpers.taand'),
    '<p>{{ text($title).slug() }}</p>',
  );

  const config = { get: (k, fb) => (k === 'app.name' ? 'Taand' : fb) };
  const app = Object.assign(new Container(), {
    debug: false,
    make(name) {
      if (name === 'config') return config;
      if (name === 'route') return { url: () => '/' };
      return null;
    },
    has(name) {
      return name === 'config' || name === 'route';
    },
  });

  const engine = new ViewEngine(app);
  engine.configure({ viewsPath: views, cachePath: cache, cacheEnabled: false });

  const html = await engine.render('helpers', { title: 'Hello World' });
  assert.match(html, /hello-world/);
  fs.rmSync(tmp, { recursive: true, force: true });
});
