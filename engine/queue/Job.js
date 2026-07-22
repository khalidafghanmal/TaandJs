/**
 * Base job class — extend and implement handle().
 */
export class Job {
  constructor(app, data = {}) {
    this.app = app;
    Object.assign(this, data);
  }

  queue = 'default';
  tries = 3;
  timeout = 60;
  backoff = [10, 30, 60];

  async handle() {}

  async failed(_error) {}

  serialize() {
    const data = {};
    for (const key of Object.keys(this)) {
      if (key === 'app') continue;
      if (['queue', 'tries', 'timeout', 'backoff'].includes(key)) continue;
      data[key] = this[key];
    }
    return data;
  }
}
