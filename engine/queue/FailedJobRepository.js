import crypto from 'node:crypto';

/**
 * Failed job storage via Prisma.
 */
export class FailedJobRepository {
  constructor(app) {
    this.app = app;
  }

  async store({ uuid, queue, payload, exception }) {
    return this.app.make('db').failedJob.create({
      data: { uuid, queue, payload, exception },
    });
  }

  async all(limit = 50) {
    return this.app.make('db').failedJob.findMany({
      orderBy: { failedAt: 'desc' },
      take: limit,
    });
  }

  async find(uuid) {
    return this.app.make('db').failedJob.findUnique({ where: { uuid } });
  }

  async forget(uuid) {
    await this.app.make('db').failedJob.delete({ where: { uuid } }).catch(() => {});
  }

  async retry(uuid, queueManager) {
    const failed = await this.find(uuid);
    if (!failed) throw new Error('[Taand] Failed job not found');

    await queueManager.pushRaw({
      queue: failed.queue,
      payload: failed.payload,
      maxAttempts: 3,
    });

    await this.forget(uuid);
    return true;
  }
}
