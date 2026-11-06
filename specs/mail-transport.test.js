import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { MimeBuilder } from '../engine/mail/MimeBuilder.js';
import { SmtpDriver } from '../engine/mail/drivers/SmtpDriver.js';

// Tiny MIME parser: returns the leaf parts ({ type, encoding, body }) of a CRLF message.
function leaves(entity) {
  const split = entity.indexOf('\r\n\r\n');
  const head = split === -1 ? entity : entity.slice(0, split);
  const body = split === -1 ? '' : entity.slice(split + 4);
  const header = (name) => head.match(new RegExp(`^${name}:[ \t]*([^\r\n]+)`, 'im'))?.[1] ?? '';
  const type = header('Content-Type');
  const boundary = type.match(/boundary="([^"]+)"/)?.[1];
  if (!boundary) {
    return [{ type: type.split(';')[0], encoding: header('Content-Transfer-Encoding'), body }];
  }
  const close = body.indexOf(`--${boundary}--`);
  assert.notEqual(close, -1, `missing closing boundary for ${type}`);
  return body.slice(0, close).split(`--${boundary}\r\n`).slice(1)
    .flatMap((part) => leaves(part.replace(/\r\n$/, '')));
}

const base = {
  from: { name: '', email: 'app@example.com' },
  to: [{ name: '', email: 'user@example.com' }],
  subject: 'Report',
};
const attachment = { path: path.resolve('package.json'), name: 'package.json', mime: 'application/json' };

test('mime html-only message with attachment keeps the html body as a real part', () => {
  const parts = leaves(new MimeBuilder().build({ ...base, html: '<p>Hi</p>', attachments: [attachment] }));
  assert.deepEqual(parts.map((p) => p.type), ['text/html', 'application/json']);
  assert.equal(parts[0].body, '<p>Hi</p>');
});

test('mime text-only message with attachment keeps the text body as a real part', () => {
  const parts = leaves(new MimeBuilder().build({ ...base, text: 'Hello', attachments: [attachment] }));
  assert.deepEqual(parts.map((p) => p.type), ['text/plain', 'application/json']);
  assert.equal(parts[0].body, 'Hello');
});

test('mime html+text message with attachment nests multipart/alternative', () => {
  const parts = leaves(new MimeBuilder().build({ ...base, text: 'Hello', html: '<p>Hi</p>', attachments: [attachment] }));
  assert.deepEqual(parts.map((p) => p.type), ['text/plain', 'text/html', 'application/json']);
});

test('mime base64 attachments are wrapped at 76 characters', () => {
  const parts = leaves(new MimeBuilder().build({ ...base, text: 'Hello', attachments: [attachment] }));
  const encoded = parts[1].body;
  const lines = encoded.split('\r\n');
  assert.ok(lines.length > 1);
  assert.ok(lines.every((line) => line.length <= 76), 'base64 line longer than 76 chars');
  assert.deepEqual(Buffer.from(lines.join(''), 'base64'), fs.readFileSync(attachment.path));
});

// SMTP server that sends every reply in two TCP chunks to exercise reply framing.
async function choppySmtpServer() {
  const commands = [];
  const server = net.createServer((socket) => {
    let buffer = '';
    let inData = false;
    let authStep = 0;
    const reply = async (text) => {
      const cut = Math.max(2, text.length - 9);
      socket.write(text.slice(0, cut));
      await new Promise((r) => setTimeout(r, 20));
      socket.write(text.slice(cut));
    };
    socket.on('error', () => {});
    socket.write('220 test ready\r\n');
    socket.on('data', async (chunk) => {
      buffer += chunk;
      let index;
      while ((index = buffer.indexOf('\r\n')) !== -1) {
        const line = buffer.slice(0, index);
        buffer = buffer.slice(index + 2);
        if (inData) {
          if (line === '.') {
            inData = false;
            await reply('250 queued\r\n');
          }
          continue;
        }
        commands.push(line);
        if (authStep === 1 || authStep === 2) {
          authStep += 1;
          await reply(authStep === 2 ? '334 UGFzc3dvcmQ6\r\n' : '235 authenticated\r\n');
        } else if (line.startsWith('EHLO')) {
          await reply('250-test.local greets you\r\n250-AUTH LOGIN\r\n250 SIZE 1000000\r\n');
        } else if (line === 'AUTH LOGIN') {
          authStep = 1;
          await reply('334 VXNlcm5hbWU6\r\n');
        } else if (line === 'DATA') {
          inData = true;
          await reply('354 go ahead\r\n');
        } else if (line === 'QUIT') {
          socket.end('221 bye\r\n');
        } else {
          await reply('250 ok\r\n');
        }
      }
    });
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  return { port: server.address().port, commands, close: () => server.close() };
}

test('smtp driver reads multi-line replies split across TCP chunks', async () => {
  const server = await choppySmtpServer();
  try {
    const driver = new SmtpDriver({ host: '127.0.0.1', port: server.port, username: 'u', password: 'p', timeout: 2000 });
    const result = await driver.send(base, 'Subject: Report\r\n\r\nHello');
    assert.equal(result.driver, 'smtp');
    assert.deepEqual(server.commands.slice(0, 2), ['EHLO Taand.local', 'AUTH LOGIN']);
    assert.ok(server.commands.includes('RCPT TO:<user@example.com>'));
  } finally {
    server.close();
  }
});

test('mime separates headers from body with a blank line', () => {
  const parts = leaves(new MimeBuilder().build({ ...base, text: 'Hello' }));
  assert.deepEqual(parts, [{ type: 'text/plain', encoding: '', body: 'Hello' }]);
});
