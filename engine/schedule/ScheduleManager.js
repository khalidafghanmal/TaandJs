import { CronExpressionParser } from 'cron-parser';

/**
 * Single scheduled task definition.
 */
export class ScheduledEvent {
  constructor(scheduler, handler) {
    this.scheduler = scheduler;
    this.handler = handler;
    this.expression = '* * * * *';
    this.timezone = 'UTC';
    this.preventOverlaps = false;
    this.description = '';
  }

  cron(expression) {
    this.expression = expression;
    return this;
  }

  everyMinute() {
    return this.cron('* * * * *');
  }

  everyFiveMinutes() {
    return this.cron('*/5 * * * *');
  }

  hourly() {
    return this.cron('0 * * * *');
  }

  dailyAt(time = '00:00') {
    const [hour, minute] = time.split(':');
    return this.cron(`${minute ?? 0} ${hour ?? 0} * * *`);
  }

  daily() {
    return this.dailyAt('00:00');
  }

  weekly() {
    return this.cron('0 0 * * 0');
  }

  withoutOverlapping() {
    this.preventOverlaps = true;
    return this;
  }

  name(description) {
    this.description = description;
    return this;
  }

  isDue(at = new Date()) {
    try {
      const from = new Date(at.getTime() - 60_000);
      const interval = CronExpressionParser.parse(this.expression, { currentDate: from });
      const next = interval.next().toDate();
      const nextMinute = Math.floor(next.getTime() / 60_000);
      const atMinute = Math.floor(at.getTime() / 60_000);
      return nextMinute === atMinute;
    } catch {
      return false;
    }
  }
}

/**
 * Task scheduler — Taand schedule equivalent.
 */
export class ScheduleManager {
  constructor(app) {
    this.app = app;
    this.#events = [];
  }

  #events;

  command(name, args = []) {
    const event = new ScheduledEvent(this, { type: 'command', command: name, args });
    this.#events.push(event);
    return event;
  }

  call(callback) {
    const event = new ScheduledEvent(this, { type: 'call', callback });
    this.#events.push(event);
    return event;
  }

  job(jobClass, payload = {}) {
    const event = new ScheduledEvent(this, { type: 'job', job: jobClass, payload });
    this.#events.push(event);
    return event;
  }

  events() {
    return [...this.#events];
  }

  dueEvents(at = new Date()) {
    return this.#events.filter((event) => event.isDue(at));
  }

  async runDue(at = new Date()) {
    const due = this.dueEvents(at);
    const results = [];

    for (const event of due) {
      // Unnamed tasks are keyed by registration order; JSON.stringify drops callbacks and job classes.
      const lockKey = `schedule:${event.description || `#${this.#events.indexOf(event)}`}`;
      if (event.preventOverlaps && this.app.has('cache')) {
        const locked = await this.app.make('cache').add(lockKey, true, 300);
        if (!locked) continue;
      }

      try {
        results.push(await this.#runEvent(event));
      } catch (error) {
        results.push({ type: event.handler.type, ok: false, error: error.message });
      } finally {
        if (event.preventOverlaps && this.app.has('cache')) {
          await this.app.make('cache').forget(lockKey);
        }
      }
    }

    return results;
  }

  async #runEvent(event) {
    const handler = event.handler;

    if (handler.type === 'call') {
      await handler.callback(this.app);
      return { type: 'call', ok: true };
    }

    if (handler.type === 'command') {
      const { createRegistry } = await import('../cli/registry.js');
      const registry = createRegistry();
      const command = await registry.load(handler.command);
      if (!command) {
        throw new Error(`[Taand] Unknown scheduled command [${handler.command}]`);
      }
      await command.run({
        argv: [handler.command, ...(handler.args ?? [])],
        positionals: handler.args ?? [],
        options: {},
        flags: {},
      });
      return { type: 'command', command: handler.command, ok: true };
    }

    if (handler.type === 'job') {
      const job = new handler.job(this.app, handler.payload);
      await this.app.make('queue').dispatch(job).push();
      return { type: 'job', job: handler.job?.name, ok: true };
    }

    return { ok: false };
  }
}
