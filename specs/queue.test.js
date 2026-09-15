import test from 'node:test';
import assert from 'node:assert/strict';
import { QueueManager } from '../engine/queue/QueueManager.js';
import { Job } from '../engine/queue/Job.js';
import { Container } from '../engine/core/Container.js';
import { Config } from '../engine/core/Config.js';

class TestJob extends Job {
  static ran = [];

  async handle() {
    TestJob.ran.push(this.message);
  }

  serialize() {
    return { message: this.message };
  }
}

function queueApp(driver = 'array') {
  TestJob.ran = [];
  const app = Object.assign(new Container(), { basePath: process.cwd(), debug: false });
  const config = new Config();
  config.merge({
    queue: {
      default: driver,
      connections: {
        sync: { driver: 'sync' },
        array: { driver: 'array' },
        null: { driver: 'null' },
      },
    },
  });
  app.make = (name) => {
    if (name === 'config') return config;
    if (name === 'queue') return new QueueManager(app);
    if (name === 'queue.failed') return { store: async () => {} };
    return null;
  };
  app.has = (name) => ['config', 'queue', 'queue.failed'].includes(name);
  const queue = new QueueManager(app);
  return { app, queue };
}

test('array driver pushes and pops jobs', async () => {
  const { queue } = queueApp('array');
  const id = await queue.pushRaw({
    queue: 'default',
    payload: JSON.stringify({
      job: 'TestJob',
      data: { message: 'hello' },
      meta: { tries: 3, timeout: 60 },
    }),
  });
  assert.ok(id);
  const driver = queue.connection('array');
  assert.equal(await driver.size(), 1);
  const record = await driver.pop('default');
  assert.ok(record);
  assert.equal(record.queue, 'default');
});

test('dispatch returns pending dispatch', async () => {
  const { app, queue } = queueApp('array');
  const job = new TestJob(app, { message: 'queued' });
  const pending = queue.dispatch(job);
  assert.ok(pending);
  assert.equal(typeof pending.push, 'function');
});

test('array driver flush clears queue', async () => {
  const { queue } = queueApp('array');
  const driver = queue.connection('array');
  await queue.pushRaw({
    queue: 'default',
    payload: JSON.stringify({ job: 'X', data: {}, meta: {} }),
  });
  driver.flush();
  assert.equal(await driver.size(), 0);
});
