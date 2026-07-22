import crypto from 'node:crypto';

/**
 * Redis queue driver — LPUSH/RPOP with delayed jobs via sorted set.
 */
export class RedisDriver {
  constructor(app, { connection = 'default', queue: defaultQueue = 'default', retryAfter = 90 } = {}) {
    this.app = app;
    this.#connection = connection;
    this.#defaultQueue = defaultQueue;
    this.#retryAfter = retryAfter;
  }

  #connection;
  #defaultQueue;
  #retryAfter;

  #redis() {
    return this.app.make('redis').connection(this.#connection);
  }

  #prefix() {
    const connections = this.app.make('config').get('redis.connections', {});
    return connections[this.#connection]?.prefix ?? 'Taand:queue:';
  }

  #listKey(queue) {
    return `${this.#prefix()}list:${queue}`;
  }

  #delayedKey(queue) {
    return `${this.#prefix()}delayed:${queue}`;
  }

  #reservedKey(queue, id) {
    return `${this.#prefix()}reserved:${queue}:${id}`;
  }

  async push(record) {
    const id = crypto.randomUUID();
    const queue = record.queue ?? this.#defaultQueue;
    const job = {
      id,
      queue,
      payload: typeof record.payload === 'string' ? record.payload : JSON.stringify(record.payload),
      maxAttempts: record.maxAttempts ?? 3,
      availableAt: record.availableAt ?? new Date().toISOString(),
      attempts: 0,
      reservedAt: null,
    };

    const availableAt = new Date(job.availableAt).getTime();
    const serialized = JSON.stringify(job);

    if (availableAt > Date.now()) {
      const client = await this.#redis().raw();
      await client.zAdd(this.#delayedKey(queue), { score: availableAt, value: serialized });
    } else {
      await this.#redis().lPush(this.#listKey(queue), serialized);
    }

    return id;
  }

  async pop(queue = 'default') {
    await this.#migrateDelayed(queue);

    const raw = await this.#redis().rPop(this.#listKey(queue));
    if (!raw) return null;

    const job = JSON.parse(raw);
    job.attempts += 1;
    job.reservedAt = new Date().toISOString();

    await this.#redis().setEx(
      this.#reservedKey(queue, job.id),
      this.#retryAfter,
      JSON.stringify(job),
    );

    return job;
  }

  async delete(id) {
    const client = await this.#redis().raw();
    const keys = await client.keys(`*reserved:*:${id}`);
    if (keys.length) await client.del(keys);
  }

  async release(id, delaySeconds = 0) {
    const client = await this.#redis().raw();
    const keys = await client.keys(`*reserved:*:${id}`);
    if (!keys.length) return;

    const raw = await client.get(keys[0]);
    await client.del(keys[0]);
    if (!raw) return;

    const job = JSON.parse(raw);
    job.reservedAt = null;
    job.availableAt = new Date(Date.now() + delaySeconds * 1000).toISOString();
    const serialized = JSON.stringify(job);

    if (delaySeconds > 0) {
      await client.zAdd(this.#delayedKey(job.queue), {
        score: Date.now() + delaySeconds * 1000,
        value: serialized,
      });
    } else {
      await client.lPush(this.#listKey(job.queue), serialized);
    }
  }

  async size(queue = 'default') {
    await this.#migrateDelayed(queue);
    return this.#redis().lLen(this.#listKey(queue));
  }

  async all(queue = null) {
    const client = await this.#redis().raw();
    const queues = queue ? [queue] : [this.#defaultQueue];
    const jobs = [];

    for (const q of queues) {
      const len = await client.lLen(this.#listKey(q));
      if (len === 0) continue;
      const items = await client.lRange(this.#listKey(q), 0, 49);
      for (const raw of items) {
        try {
          jobs.push(JSON.parse(raw));
        } catch {
          /* skip */
        }
      }
    }

    return jobs;
  }

  async #migrateDelayed(queue) {
    const client = await this.#redis().raw();
    const now = Date.now();
    const ready = await client.zRangeByScore(this.#delayedKey(queue), 0, now);

    for (const raw of ready) {
      await client.lPush(this.#listKey(queue), raw);
      await client.zRem(this.#delayedKey(queue), raw);
    }
  }
}
