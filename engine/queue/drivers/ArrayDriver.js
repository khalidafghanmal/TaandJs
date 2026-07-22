/**
 * In-memory queue — dev, tests, dashboard.
 */
export class ArrayDriver {
  constructor() {
    this.#jobs = [];
    this.#id = 0;
  }

  #jobs;
  #id;

  async push(record) {
    const id = `array_${++this.#id}`;
    this.#jobs.push({
      ...record,
      id,
      attempts: 0,
      reservedAt: null,
    });
    return id;
  }

  async pop(queue = 'default') {
    const now = Date.now();
    const index = this.#jobs.findIndex((job) => {
      if (job.queue !== queue) return false;
      if (job.reservedAt) return false;
      return new Date(job.availableAt).getTime() <= now;
    });

    if (index === -1) return null;

    const job = this.#jobs[index];
    job.reservedAt = new Date().toISOString();
    job.attempts += 1;
    return job;
  }

  async delete(id) {
    this.#jobs = this.#jobs.filter((j) => j.id !== id);
  }

  async release(id, delaySeconds = 0) {
    const job = this.#jobs.find((j) => j.id === id);
    if (!job) return;
    job.reservedAt = null;
    job.availableAt = new Date(Date.now() + delaySeconds * 1000).toISOString();
  }

  size(queue = null) {
    if (queue) return this.#jobs.filter((j) => j.queue === queue && !j.reservedAt).length;
    return this.#jobs.filter((j) => !j.reservedAt).length;
  }

  all() {
    return [...this.#jobs];
  }

  flush() {
    this.#jobs = [];
  }
}
