import { JobPayload } from './JobPayload.js';
import { PendingDispatch } from './PendingDispatch.js';
import { SyncDriver } from './drivers/SyncDriver.js';
import { ArrayDriver } from './drivers/ArrayDriver.js';
import { DatabaseDriver } from './drivers/DatabaseDriver.js';
import { NullDriver } from './drivers/NullDriver.js';
import { RedisDriver } from './drivers/RedisDriver.js';
import { QueueWorker } from './QueueWorker.js';

/**
 * Queue manager — Taand's Queue facade equivalent.
 */
export class QueueManager {
  constructor(app) {
    this.app = app;
    this.#connections = new Map();
    this.#drivers = new Map();
    this.#default = app.make('config').get('queue.default', 'sync');
    this.#worker = new QueueWorker(app);
  }

  #connections;
  #drivers;
  #default;
  #worker;

  connection(name = null) {
    const resolved = name ?? this.#default;
    if (!this.#drivers.has(resolved)) {
      this.#drivers.set(resolved, this.#createDriver(resolved));
    }
    return this.#drivers.get(resolved);
  }

  dispatch(job) {
    return new PendingDispatch(this, job);
  }

  async push(job, options = {}) {
    return this.dispatch(job).push(options);
  }

  async later(seconds, job) {
    return this.dispatch(job).delay(seconds).push();
  }

  async batch(jobs, { queue = 'default', connection = null } = {}) {
    const ids = [];
    for (const job of jobs) {
      ids.push(await this.dispatch(job).onQueue(queue).connection(connection).push());
    }
    return ids;
  }

  async pushRaw(record, connection = null) {
    const driver = this.connection(connection);
    const payload = typeof record.payload === 'string'
      ? record.payload
      : JSON.stringify(record.payload);

    return driver.push({
      queue: record.queue ?? 'default',
      payload,
      maxAttempts: record.maxAttempts ?? 3,
      availableAt: record.availableAt ?? new Date().toISOString(),
    });
  }

  async process(record) {
    return this.#worker.run({
      ...record,
      attempts: record.attempts ?? 1,
    });
  }

  worker() {
    return this.#worker;
  }

  async overview() {
    const connections = this.app.make('config').get('queue.connections', {});
    const result = {};

    for (const name of Object.keys(connections)) {
      const driver = this.connection(name);
      const jobs = driver.all ? await driver.all() : [];
      const pending = driver.size ? await driver.size() : jobs.filter((j) => !j.reservedAt).length;
      result[name] = {
        driver: connections[name].driver,
        pending,
        jobs: jobs.slice(0, 50),
      };
    }

    const failed = this.app.has('queue.failed')
      ? await this.app.make('queue.failed').all(20)
      : [];

    return { connections: result, failed };
  }

  #createDriver(name) {
    const connections = this.app.make('config').get('queue.connections', {});
    const config = connections[name];
    if (!config) {
      throw new Error(`[Taand] Queue connection [${name}] is not defined`);
    }

    const driver = config.driver ?? 'sync';

    if (driver === 'null') return new NullDriver();
    if (driver === 'sync') {
      // Sync jobs run once in-process, so the first failure is final.
      return new SyncDriver((record) => this.process({ ...record, attempts: 1, maxAttempts: 1 }));
    }
    if (driver === 'array') return new ArrayDriver();
    if (driver === 'database') return new DatabaseDriver(this.app, config);
    if (driver === 'redis') return new RedisDriver(this.app, config);

    throw new Error(`[Taand] Unsupported queue driver [${driver}] on [${name}]`);
  }
}
