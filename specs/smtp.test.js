import test from 'node:test';
import assert from 'node:assert/strict';
import net from 'node:net';
import { SmtpDriver } from '../engine/mail/drivers/SmtpDriver.js';

// Minimal SMTP server: records commands and the un-stuffed DATA payload of each message.
async function smtpServer() {
  const commands = [];
  const messages = [];
  let closed;
  const done = new Promise((r) => { closed = r; });

  const server = net.createServer((socket) => {
    let buffer = '';
    let data = null;
    socket.write('220 test ready\r\n');
    socket.on('data', (chunk) => {
      buffer += chunk;
      let index;
      while ((index = buffer.indexOf('\r\n')) !== -1) {
        const line = buffer.slice(0, index);
        buffer = buffer.slice(index + 2);
        if (data) {
          if (line === '.') {
            messages.push(data.join('\r\n'));
            data = null;
            socket.write('250 queued\r\n');
          } else {
            data.push(line.startsWith('.') ? line.slice(1) : line);
          }
          continue;
        }
        commands.push(line);
        if (line === 'DATA') {
          data = [];
          socket.write('354 go ahead\r\n');
        } else if (line === 'QUIT') {
          socket.end('221 bye\r\n');
        } else {
          socket.write('250 ok\r\n');
        }
      }
    });
    socket.on('error', () => {});
    socket.on('close', closed);
  });

  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  return { port: server.address().port, commands, messages, done, close: () => server.close() };
}

const envelope = { from: { email: 'app@example.com' }, to: [{ email: 'user@example.com' }] };

test('smtp driver dot-stuffs the body so a lone "." cannot end DATA early', async () => {
  const server = await smtpServer();
  try {
    const raw = 'Subject: hi\r\n\r\nline one\r\n.\r\nMAIL FROM:<attacker@evil.test>\r\nRCPT TO:<victim@example.com>\r\n.leading dot\r\nend';
    await new SmtpDriver({ host: '127.0.0.1', port: server.port, timeout: 2000 }).send(envelope, raw);
    await server.done;

    assert.deepEqual(server.commands, [
      'EHLO Taand.local',
      'MAIL FROM:<app@example.com>',
      'RCPT TO:<user@example.com>',
      'DATA',
      'QUIT',
    ]);
    assert.deepEqual(server.messages, [raw]);
  } finally {
    server.close();
  }
});

test('smtp driver normalizes bare CR and LF to CRLF so they cannot smuggle a terminator', async () => {
  const server = await smtpServer();
  try {
    const raw = 'Subject: hi\r\n\r\nfirst\n.\nMAIL FROM:<attacker@evil.test>\rlast';
    await new SmtpDriver({ host: '127.0.0.1', port: server.port, timeout: 2000 }).send(envelope, raw);
    await server.done;

    assert.equal(server.commands.length, 5);
    assert.deepEqual(server.messages, ['Subject: hi\r\n\r\nfirst\r\n.\r\nMAIL FROM:<attacker@evil.test>\r\nlast']);
  } finally {
    server.close();
  }
});
