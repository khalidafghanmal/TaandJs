/**
 * Database queue driver — persistent jobs via Prisma.
 */
export class DatabaseDriver {
  constructor(app, { queue: defaultQueue = 'default', retryAfter = 90 } = {}) {
    this.app = app;
    this.#retryAfter = retryAfter;
    this.#defaultQueue = defaultQueue;
  }

  #retryAfter;
  #defaultQueue;

  #db() {
    return this.app.make('db');
  }

  async push(record) {
    const row = await this.#db().job.create({
      data: {
        queue: record.queue ?? this.#defaultQueue,
        payload: typeof record.payload === 'string' ? record.payload : JSON.stringify(record.payload),
        maxAttempts: record.maxAttempts ?? 3,
        availableAt: new Date(record.availableAt ?? Date.now()),
      },
    });
    return String(row.id);
  }

  async pop(queue = 'default') {
    const stale = new Date(Date.now() - this.#retryAfter * 1000);

    await this.#db().job.updateMany({
      where: {
        queue,
        reservedAt: { lt: stale },
      },
      data: { reservedAt: null },
    });

    const row = await this.#db().job.findFirst({
      where: {
        queue,
        reservedAt: null,
        availableAt: { lte: new Date() },
      },
      orderBy: { id: 'asc' },
    });

    if (!row) return null;

    await this.#db().job.update({
      where: { id: row.id },
      data: {
        reservedAt: new Date(),
        attempts: { increment: 1 },
      },
    });

    return {
      id: String(row.id),
      queue: row.queue,
      payload: row.payload,
      attempts: row.attempts + 1,
      maxAttempts: row.maxAttempts,
      reservedAt: new Date().toISOString(),
    };
  }

  async delete(id) {
    await this.#db().job.delete({ where: { id: Number(id) } }).catch(() => {});
  }

  async release(id, delaySeconds = 0) {
    await this.#db().job.update({
      where: { id: Number(id) },
      data: {
        reservedAt: null,
        availableAt: new Date(Date.now() + delaySeconds * 1000),
      },
    }).catch(() => {});
  }

  async size(queue = 'default') {
    return this.#db().job.count({
      where: { queue, reservedAt: null, availableAt: { lte: new Date() } },
    });
  }

  all(queue = null) {
    return this.#db().job.findMany({
      where: queue ? { queue } : {},
      orderBy: { id: 'desc' },
      take: 100,
    });
  }
}
