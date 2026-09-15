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
