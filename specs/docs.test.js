import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const DOCS = [
  ...fs.readdirSync(path.join(ROOT, 'docs'))
    .filter((f) => f.endsWith('.md'))
    .map((f) => path.join('docs', f)),
  'CONTRIBUTING.md',
  'starter/README.md',
];

function scan(pattern, toTarget) {
  const missing = [];
  for (const doc of DOCS) {
    const text = fs.readFileSync(path.join(ROOT, doc), 'utf8');
    for (const match of text.matchAll(pattern)) {
      const target = toTarget(match, doc);
      if (target && !fs.existsSync(target)) missing.push(`${doc}: ${match[0]}`);
    }
  }
  return missing;
}

test('docs reference settings/*.js files that exist (no legacy config/*.js)', () => {
  // Globs like `settings/*.js` only need the directory to exist.
  const missing = scan(/\b(?:config|settings)\/[\w*-]+\.js\b/g, ([ref]) =>
    path.join(ROOT, ref.includes('*') ? path.dirname(ref) : ref));
  assert.deepEqual(missing, []);
});

test('docs relative links point at existing files', () => {
  const missing = scan(/\]\(([^)\s]+)\)/g, ([, href], doc) => {
    if (/^(?:[a-z]+:|#)/i.test(href)) return null;
    return path.resolve(ROOT, path.dirname(doc), href.split('#')[0]);
  });
  assert.deepEqual(missing, []);
});
