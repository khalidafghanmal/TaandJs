import test from 'node:test';
import assert from 'node:assert/strict';
import { MailManager } from '../engine/mail/MailManager.js';
import { MailMessage } from '../engine/mail/MailMessage.js';
import { Container } from '../engine/core/Container.js';
import { Config } from '../engine/core/Config.js';

function mailApp() {
  const app = Object.assign(new Container(), { basePath: process.cwd(), debug: false });
  const config = new Config();
  config.merge({
    mail: {
      default: 'array',
      rateLimit: 100,
      from: { address: 'from@example.com', name: 'Taand' },
      mailers: {
        array: { transport: 'array' },
        log: { transport: 'log' },
        null: { transport: 'null' },
      },
    },
  });
  app.make = (name) => (name === 'config' ? config : null);
  app.has = () => false;
  return { app, mail: new MailManager(app) };
}

test('mail sends via array driver', async () => {
  const { app, mail } = mailApp();
  const message = MailMessage.make(app)
    .to('user@example.com')
    .subject('Hello')
    .html('<p>Hi</p>');

  const result = await mail.send(message, 'array');
  assert.ok(result.id);
  const sent = mail.sent('array');
  assert.equal(sent.length, 1);
  assert.equal(sent[0].message.subject, 'Hello');
});

test('mail to() fluent API', async () => {
  const { mail } = mailApp();
  const pending = mail.to('a@example.com', 'b@example.com');
  assert.ok(pending);
  assert.equal(typeof pending.send, 'function');
  assert.equal(typeof pending.to, 'function');
});

test('mail resolve builds MailMessage', async () => {
  const { app, mail } = mailApp();
  const message = MailMessage.make(app).to('x@example.com').subject('Test').text('body');
  const resolved = await mail.resolve(message);
  assert.equal(resolved.subject, 'Test');
  assert.equal(resolved.to.length, 1);
});

test('mail null driver accepts send without storing', async () => {
  const { app, mail } = mailApp();
  const message = MailMessage.make(app).to('void@example.com').subject('Void').text('x');
  await mail.send(message, 'null');
  assert.equal(mail.sent('array').length, 0);
});

test('mail rejects invalid input', async () => {
  const { mail } = mailApp();
  await assert.rejects(() => mail.resolve({}), /Invalid mailable/);
});

async function outsideFile() {
  const fsp = await import('node:fs/promises');
  const os = await import('node:os');
  const path = await import('node:path');
  const dir = await fsp.mkdtemp(path.join(os.tmpdir(), 'taand-mail-outside-'));
  const file = path.join(dir, 'secret.txt');
  await fsp.writeFile(file, 'top secret');
  return { dir, file, cleanup: () => fsp.rm(dir, { recursive: true, force: true }) };
}

test('mail rejects plain-object attachments outside the app directory', async () => {
  const { mail } = mailApp();
  const outside = await outsideFile();
  try {
    await assert.rejects(() => mail.send({
      from: { email: 'app@example.com' },
      to: [{ email: 'user@example.com' }],
      subject: 'Hi',
      text: 'body',
      attachments: [{ path: outside.file, name: 'secret.txt' }],
    }, 'array'), /Attachment/);
    assert.equal(mail.sent('array').length, 0);
  } finally {
    await outside.cleanup();
  }
});

test('mail attachFromStorage cannot traverse out of public storage', () => {
  const { app } = mailApp();
  assert.throws(() => MailMessage.make(app).attachFromStorage('../../../package.json'), /Attachment/);
});

test('mail attach rejects a symlink inside the app that points outside it', async (t) => {
  const fsp = await import('node:fs/promises');
  const path = await import('node:path');
  const { app } = mailApp();
  const outside = await outsideFile();
  const root = await outsideFile();
  app.basePath = root.dir;
  const link = path.join(root.dir, 'linked');
  try {
    try {
      // A directory junction needs no extra privileges on Windows; elsewhere it is a plain symlink.
      await fsp.symlink(outside.dir, link, 'junction');
    } catch {
      t.skip('symlinks not permitted on this system');
      return;
    }
    assert.throws(() => MailMessage.make(app).attach(path.join(link, 'secret.txt')), /Attachment/);
  } finally {
    await outside.cleanup();
    await root.cleanup();
  }
});
