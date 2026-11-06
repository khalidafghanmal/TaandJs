import test from 'node:test';
import assert from 'node:assert/strict';
import { QueueManager } from '../engine/queue/QueueManager.js';
import { Job } from '../engine/queue/Job.js';
import { Container } from '../engine/core/Container.js';
import { Config } from '../engine/core/Config.js';
import { QueueWorker, RetryError } from '../engine/queue/QueueWorker.js';
import { pathToFileURL } from 'node:url';

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

function fakePrisma(rows) {
  const matches = (row, where) => Object.entries(where).every(([key, cond]) => {
    if (cond && typeof cond === 'object' && 'lt' in cond) return row[key] !== null && row[key] < cond.lt;
    if (cond && typeof cond === 'object' && 'lte' in cond) return row[key] <= cond.lte;
    return row[key] === cond;
  });
  const apply = (row, data) => {
    for (const [key, value] of Object.entries(data)) {
      row[key] = value?.increment ? row[key] + value.increment : value;
    }
  };
  // Every call yields to the event loop so concurrent pops interleave like real queries.
  const tick = () => new Promise((r) => setImmediate(r));
  return {
    job: {
      async findFirst({ where }) {
        await tick();
        const row = rows.filter((r) => matches(r, where)).sort((a, b) => a.id - b.id)[0];
        return row ? { ...row } : null;
      },
      async updateMany({ where, data }) {
        await tick();
        const hit = rows.filter((r) => matches(r, where));
        hit.forEach((r) => apply(r, data));
        return { count: hit.length };
      },
      async update({ where, data }) {
        await tick();
        apply(rows.find((r) => r.id === where.id), data);
      },
    },
  };
}

test('database driver never hands the same job to two workers', async () => {
  const { DatabaseDriver } = await import('../engine/queue/drivers/DatabaseDriver.js');
  const row = (id) => ({ id, queue: 'default', payload: '{}', attempts: 0, maxAttempts: 3, reservedAt: null, availableAt: new Date(0) });
  const db = fakePrisma([row(1), row(2)]);
  const driver = new DatabaseDriver({ make: () => db });

  const [a, b, c] = await Promise.all([driver.pop(), driver.pop(), driver.pop()]);
  const ids = [a, b, c].filter(Boolean).map((r) => r.id).sort();
  assert.deepEqual(ids, ['1', '2']);
});

test('awaiting queue.dispatch() pushes the job', async () => {
  const { app, queue } = queueApp('array');
  await queue.dispatch(new TestJob(app, { message: 'awaited' })).onQueue('emails');
  assert.equal(await queue.connection('array').size('emails'), 1);
});

async function workerApp(jobSource) {
  const fsp = await import('node:fs/promises');
  const os = await import('node:os');
  const path = await import('node:path');
  const tmp = await fsp.mkdtemp(path.join(os.tmpdir(), 'taand-queue-'));
  await fsp.mkdir(path.join(tmp, 'src', 'jobs'), { recursive: true });
  if (jobSource) await fsp.writeFile(path.join(tmp, 'src', 'jobs', 'FlakyJob.js'), jobSource);

  const { app } = queueApp('sync');
  app.basePath = tmp;
  const stored = [];
  const make = app.make;
  app.make = (name) => (name === 'queue.failed' ? { store: async (r) => stored.push(r) } : make(name));
  const cleanup = () => fsp.rm(tmp, { recursive: true, force: true });
  return { app, worker: new QueueWorker(app), stored, cleanup };
}

const flakyJob = `
export class FlakyJob {
  async handle() { throw new Error('boom'); }
  async failed() { globalThis.__flakyFailed = (globalThis.__flakyFailed ?? 0) + 1; THROW_IN_FAILED }
}
`;

const payload = (job) => JSON.stringify({ v: 1, job, data: {}, meta: { tries: 3, backoff: [1] } });

test('worker only calls failed() on the final attempt', async () => {
  const { worker, stored, cleanup } = await workerApp(flakyJob.replace('THROW_IN_FAILED', ''));
  globalThis.__flakyFailed = 0;
  try {
    const record = { id: '1', queue: 'default', payload: payload('FlakyJob'), maxAttempts: 3 };
    await assert.rejects(() => worker.run({ ...record, attempts: 1 }), RetryError);
    await assert.rejects(() => worker.run({ ...record, attempts: 2 }), RetryError);
    assert.equal(globalThis.__flakyFailed, 0);
    assert.equal(stored.length, 0);

    await assert.rejects(() => worker.run({ ...record, attempts: 3 }), /boom/);
    assert.equal(globalThis.__flakyFailed, 1);
    assert.equal(stored.length, 1);
  } finally {
    await cleanup();
  }
});

test('worker records failed job when failed() throws', async () => {
  const { worker, stored, cleanup } = await workerApp(flakyJob.replace('THROW_IN_FAILED', "throw new Error('hook');"));
  try {
    const record = { id: '1', queue: 'default', payload: payload('FlakyJob'), attempts: 3, maxAttempts: 3 };
    await assert.rejects(() => worker.run(record));
    assert.equal(stored.length, 1);
    assert.match(stored[0].exception, /boom/);
  } finally {
    await cleanup();
  }
});

test('worker records failed job when payload cannot be unpacked or resolved', async () => {
  const { worker, stored, cleanup } = await workerApp(null);
  try {
    await assert.rejects(() => worker.run({ id: '1', queue: 'default', payload: 'not json', attempts: 1 }));
    await assert.rejects(() => worker.run({ id: '2', queue: 'default', payload: payload('MissingJob'), attempts: 1 }), /not found/);
    assert.equal(stored.length, 2);
  } finally {
    await cleanup();
  }
});

test('sync driver treats the first failure as final', async () => {
  const { app, stored, cleanup } = await workerApp(flakyJob.replace('THROW_IN_FAILED', ''));
  globalThis.__flakyFailed = 0;
  try {
    const { FlakyJob } = await import(pathToFileURL(`${app.basePath}/src/jobs/FlakyJob.js`).href);
    await assert.rejects(() => new QueueManager(app).dispatch(new FlakyJob()).push(), /boom/);
    assert.equal(globalThis.__flakyFailed, 1);
    assert.equal(stored.length, 1);
  } finally {
    await cleanup();
  }
});
