import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { MimeBuilder } from '../engine/mail/MimeBuilder.js';

const disposition = (name) => new MimeBuilder().build({
  from: { name: '', email: 'app@example.com' },
  to: [{ name: '', email: 'user@example.com' }],
  subject: 'Files',
  text: 'see attached',
  attachments: [{ path: path.resolve('package.json'), name }],
}).match(/^Content-Disposition: (.*)$/m)[1].replace(/\r$/, '');

test('attachment filename quotes cannot add Content-Disposition parameters', () => {
  assert.equal(
    disposition('evil.exe"; filename="safe.pdf'),
    'attachment; filename="evil.exe\\"; filename=\\"safe.pdf"',
  );
  assert.equal(disposition('a\\b.txt'), 'attachment; filename="a\\\\b.txt"');
});

test('attachment filenames with CR/LF are rejected', () => {
  assert.throws(() => disposition('x.txt\r\nX-Injected: 1'), /injection/);
});

test('non-ASCII attachment filenames are RFC 2231 encoded with an ASCII fallback', () => {
  const value = disposition("Résumé (final)'s.pdf");
  assert.match(value, /^attachment; filename="R_sum_ \(final\)'s\.pdf"; filename\*=UTF-8''([A-Za-z0-9!#$&+\-.^_`|~%]+)$/);
  const encoded = value.match(/filename\*=UTF-8''(.+)$/)[1];
  assert.equal(decodeURIComponent(encoded), "Résumé (final)'s.pdf");
});
