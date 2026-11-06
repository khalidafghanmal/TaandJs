import test from 'node:test';
import assert from 'node:assert/strict';
import { MailValidator } from '../engine/mail/MailValidator.js';
import { MimeBuilder } from '../engine/mail/MimeBuilder.js';

const decodeWords = (value) => value
  .split(/\r\n /)
  .map((word) => {
    const match = word.match(/^=\?UTF-8\?B\?([A-Za-z0-9+/=]*)\?=$/);
    assert.ok(match, `not an encoded-word: ${word}`);
    assert.ok(word.length <= 75, `encoded-word longer than 75 chars: ${word.length}`);
    return Buffer.from(match[1], 'base64');
  })
  .reduce((all, buf) => Buffer.concat([all, buf]), Buffer.alloc(0))
  .toString('utf8');

// Header value including folded continuation lines.
const header = (raw, name) => raw.match(new RegExp(`^${name}: (.*(?:\\r\\n .*)*)`, 'm'))[1];

test('formatAddress escapes backslashes and quotes in display names', () => {
  assert.equal(
    MailValidator.formatAddress({ name: 'A "B" \\ C', email: 'a@example.com' }),
    '"A \\"B\\" \\\\ C" <a@example.com>',
  );
});

test('formatAddress RFC 2047 encodes non-ASCII display names', () => {
  const formatted = MailValidator.formatAddress({ name: 'José Müller', email: 'jose@example.com' });
  const [, word] = formatted.match(/^(.+) <jose@example\.com>$/);
  assert.equal(decodeWords(word), 'José Müller');
});

test('mime encodes non-ASCII subjects as folded UTF-8 encoded-words', () => {
  const subject = 'Grüße aus Köln 🎉 — '.repeat(6).trim();
  const raw = new MimeBuilder().build({
    from: { name: '', email: 'app@example.com' },
    to: [{ name: 'Zoë', email: 'zoe@example.com' }],
    subject,
    text: 'hi',
  });
  assert.equal(decodeWords(header(raw, 'Subject')), subject);
  assert.ok(raw.split('\r\n\r\n')[0].split('\r\n').every((line) => line.length <= 78));
});

test('mime leaves ASCII subjects untouched', () => {
  const raw = new MimeBuilder().build({
    from: { name: '', email: 'app@example.com' },
    to: [{ name: '', email: 'zoe@example.com' }],
    subject: 'Plain subject',
    text: 'hi',
  });
  assert.equal(header(raw, 'Subject'), 'Plain subject');
});
