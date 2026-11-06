import crypto from 'node:crypto';
import { JobPayload } from './JobPayload.js';
import { JobResolver } from './JobResolver.js';

/**
 * Processes queued jobs with timeout, retry, and failure handling.
 */
export class QueueWorker {
  constructor(app) {
    this.app = app;
    this.#resolver = new JobResolver(app);
    this.#running = false;
  }

  #resolver;
  #running;

  async run(record) {
    let payload;
    let job;

    try {
      payload = JobPayload.unpack(record.payload);
      job = await this.#resolver.resolve(payload);
    } catch (error) {
      await this.#fail(record, payload, null, error);
      throw error;
    }

    const timeoutMs = (payload.meta?.timeout ?? 60) * 1000;

    await this.#fire('job.processing', { job: payload.job, queue: record.queue, attempt: record.attempts });

    try {
      await this.#withTimeout(job.handle(), timeoutMs);
      await this.#fire('job.processed', { job: payload.job, queue: record.queue });
      return true;
    } catch (error) {
      const maxAttempts = record.maxAttempts ?? payload.meta?.tries ?? 3;
      if (record.attempts < maxAttempts) {
        const backoff = payload.meta?.backoff ?? [10, 30, 60];
        const delay = backoff[Math.min(record.attempts - 1, backoff.length - 1)] ?? 10;
        await this.#fire('job.retrying', { job: payload.job, queue: record.queue, attempt: record.attempts, delay });
        throw new RetryError(delay, error);
      }

      await this.#fail(record, payload, job, error);
      throw error;
    }
  }

  async work(connection = null, { queue = 'default', sleep = 1, maxJobs = 0 } = {}) {
    const manager = this.app.make('queue');
    const driver = manager.connection(connection);
    let processed = 0;

    this.#running = true;
    while (this.#running) {
      const record = await driver.pop(queue);
      if (!record) {
        if (maxJobs > 0 && processed >= maxJobs) break;
        await this.#sleep(sleep);
        continue;
      }

      try {
        await this.run(record);
        await driver.delete(record.id);
        processed += 1;
      } catch (error) {
        if (error instanceof RetryError) {
          await driver.release(record.id, error.delaySeconds);
        } else {
          await driver.delete(record.id);
        }
      }

      if (maxJobs > 0 && processed >= maxJobs) break;
    }

    return processed;
  }

  stop() {
    this.#running = false;
  }

  // Permanent failure: the failed_jobs record is written before the job's own failed() hook can throw.
  async #fail(record, payload, job, error) {
    await this.#storeFailed(record, error);
    try {
      await job?.failed?.(error);
    } finally {
      await this.#fire('job.failed', { job: payload?.job, queue: record.queue, error });
    }
  }

  async #storeFailed(record, error) {
    const uuid = crypto.randomUUID();
    const repo = this.app.make('queue.failed');

    await repo.store({
      uuid,
      queue: record.queue,
      payload: record.payload,
      exception: `${error.message}\n${error.stack ?? ''}`,
    });
  }

  async #withTimeout(promise, ms) {
    let timer;
    const timeout = new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(`[Taand] Job timed out after ${ms}ms`)), ms);
    });

    try {
      return await Promise.race([promise, timeout]);
    } finally {
      clearTimeout(timer);
    }
  }

  async #fire(name, payload) {
    if (!this.app.has('events')) return;
    await this.app.make('events').dispatch(name, payload).catch(() => {});
  }

  #sleep(seconds) {
    return new Promise((r) => setTimeout(r, seconds * 1000));
  }
}

export class RetryError extends Error {
  constructor(delaySeconds, cause) {
    super(cause?.message ?? 'Job retry');
    this.name = 'RetryError';
    this.delaySeconds = delaySeconds;
    this.cause = cause;
  }
}
