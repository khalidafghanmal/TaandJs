import { JobPayload } from './JobPayload.js';

/**
 * Fluent dispatch — onQueue(), delay(), connection().
 */
export class PendingDispatch {
  constructor(manager, job) {
    this.#manager = manager;
    this.#job = job;
    this.#queue = job.queue ?? 'default';
    this.#delay = 0;
    this.#connection = null;
  }

  #manager;
  #job;
  #queue;
  #delay;
  #connection;

  onQueue(queue) {
    this.#queue = queue;
    return this;
  }

  delay(seconds) {
    this.#delay = seconds;
    return this;
  }

  connection(name) {
    this.#connection = name;
    return this;
  }

  async push() {
    this.#job.queue = this.#queue;
    const payload = JobPayload.pack(this.#job, { queue: this.#queue, delay: this.#delay });
    const driver = this.#manager.connection(this.#connection);

    return driver.push({
      queue: this.#queue,
      payload: JSON.stringify(payload),
      maxAttempts: payload.meta.tries,
      availableAt: new Date(Date.now() + this.#delay * 1000).toISOString(),
    });
  }

  // Thenable so `await queue.dispatch(job).onQueue('x')` pushes without an explicit push().
  then(resolve, reject) {
    return this.push().then(resolve, reject);
  }
}
