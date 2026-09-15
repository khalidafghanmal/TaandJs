import test from 'node:test';
import assert from 'node:assert/strict';
import { EventDispatcher } from '../engine/events/EventDispatcher.js';
import { Event } from '../engine/events/Event.js';
import { Container } from '../engine/core/Container.js';
import { Config } from '../engine/core/Config.js';

function eventsApp() {
  const app = Object.assign(new Container(), { basePath: process.cwd(), debug: false });
  const config = new Config();
  config.merge({ events: { maxListeners: 50, stopOnFailure: false } });
  app.make = (name) => (name === 'config' ? config : null);
  app.has = () => false;
  return { app, events: new EventDispatcher(app) };
}

class UserRegistered extends Event {
  constructor(user) {
    super();
    this.user = user;
  }
}

test('events dispatch calls listeners in priority order', async () => {
  const { events } = eventsApp();
  const order = [];

  events.listen('user.registered', () => { order.push('low'); }, { priority: 1 });
  events.listen('user.registered', () => { order.push('high'); }, { priority: 10 });

  await events.dispatch('user.registered', { id: 1 });
  assert.deepEqual(order, ['high', 'low']);
});

test('events until returns first non-null result', async () => {
  const { events } = eventsApp();

  events.listen('auth.login', () => null);
  events.listen('auth.login', () => 'token-abc');

  const result = await events.until('auth.login', {});
  assert.equal(result, 'token-abc');
});

test('events forget removes listeners', async () => {
  const { events } = eventsApp();
  let called = 0;
  events.listen('ping', () => { called += 1; });
  events.forget('ping');
  await events.dispatch('ping');
  assert.equal(called, 0);
});

test('events hasListeners detects registration', () => {
  const { events } = eventsApp();
  assert.equal(events.hasListeners('missing'), false);
  events.listen('present', () => {});
  assert.equal(events.hasListeners('present'), true);
});

test('event halt stops propagation', async () => {
  const { events } = eventsApp();
  const order = [];

  events.listen('order.test', (payload) => {
    order.push('first');
    payload.halt();
  }, { priority: 10 });

  events.listen('order.test', () => {
    order.push('second');
  }, { priority: 1 });

  const evt = new UserRegistered({ id: 1 });
  await events.dispatch('order.test', evt);
  assert.deepEqual(order, ['first']);
});

test('wildcard listener matches events', async () => {
  const { events } = eventsApp();
  const matched = [];

  events.listen('user.*', (name, payload) => {
    matched.push({ name, payload });
  });

  await events.dispatch('user.created', { id: 2 });
  assert.equal(matched.length, 1);
  assert.equal(matched[0].name, 'user.created');
});
