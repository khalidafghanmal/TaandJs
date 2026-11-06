import test from 'node:test';
import assert from 'node:assert/strict';
import { MimeBuilder } from '../engine/mail/MimeBuilder.js';

const envelope = {
  from: { name: '', email: 'app@example.com' },
  to: [{ name: '', email: 'user@example.com' }],
  subject: 'Body',
};

const wrapped = (text) => Buffer.from(text).toString('base64').match(/.{1,76}/g).join('\r\n');

// Parts of a multipart/alternative message as { head, body }.
function alternativeParts(raw) {
  const boundary = raw.match(/boundary="([^"]+)"/)[1];
  return raw.split(`--${boundary}`).slice(1, -1).map((part) => {
    const [head, ...rest] = part.replace(/^\r\n|\r\n$/g, '').split('\r\n\r\n');
    return { head, body: rest.join('\r\n\r\n') };
  });
}

test('non-ASCII alternative parts are base64 encoded and wrapped at 76', () => {
  const text = 'Grüße aus Köln — '.repeat(10);
  const html = `<p>${text}</p>`;
  const parts = alternativeParts(new MimeBuilder().build({ ...envelope, text, html }));

  assert.equal(parts.length, 2);
  for (const [part, original] of [[parts[0], text], [parts[1], html]]) {
    assert.match(part.head, /^Content-Transfer-Encoding: base64\r?$/m);
    assert.ok(part.body.split('\r\n').every((line) => line.length <= 76));
    assert.equal(Buffer.from(part.body, 'base64').toString('utf8'), original);
  }
});

test('ASCII alternative parts with short lines are left as-is', () => {
  const parts = alternativeParts(new MimeBuilder().build({ ...envelope, text: 'Hello', html: '<p>Hello</p>' }));
  assert.doesNotMatch(parts[0].head, /Content-Transfer-Encoding/);
  assert.equal(parts[0].body, 'Hello');
});

test('single-part non-ASCII or long-line bodies declare and use base64', () => {
  for (const text of ['Grüße', `${'x'.repeat(1200)}\r\nend`]) {
    const raw = new MimeBuilder().build({ ...envelope, text });
    assert.match(raw, /^Content-Transfer-Encoding: base64\r?$/m);
    assert.ok(raw.endsWith(wrapped(text)));
  }
});
