import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ScheduledEvent, ScheduleManager } from '../engine/schedule/ScheduleManager.js';

describe('ScheduledEvent', () => {
  it('everyMinute matches current minute', () => {
    const event = new ScheduledEvent(null, { type: 'call' });
    event.everyMinute();
    assert.equal(event.isDue(new Date()), true);
  });

  it('daily does not match random midday unless midnight', () => {
    const event = new ScheduledEvent(null, { type: 'call' });
    event.daily();
    const noon = new Date('2026-06-28T12:00:00Z');
    assert.equal(event.isDue(noon), false);
  });
});

function scheduleApp() {
  const locks = new Set();
  const dispatched = [];
  const app = {
    has: (name) => ['cache', 'queue'].includes(name),
    make: (name) => {
      if (name === 'cache') {
        return {
          add: async (key) => (locks.has(key) ? false : (locks.add(key), true)),
          forget: async (key) => locks.delete(key),
        };
      }
      return { dispatch: (job) => ({ push: async () => dispatched.push(job) }) };
    },
  };
  return { app, locks, dispatched };
}

describe('ScheduleManager', () => {
  it('a throwing task does not stop the remaining due tasks', async () => {
    const { app } = scheduleApp();
    const schedule = new ScheduleManager(app);
    const ran = [];
    schedule.call(() => { throw new Error('boom'); });
    schedule.call(() => { ran.push('second'); });

    const results = await schedule.runDue();
    assert.deepEqual(ran, ['second']);
    assert.equal(results.length, 2);
    assert.equal(results[0].ok, false);
    assert.match(results[0].error, /boom/);
  });

  it('unnamed withoutOverlapping tasks get distinct locks', async () => {
    const { app } = scheduleApp();
    let release;
    const gate = new Promise((r) => { release = r; });
    const ran = [];
    const define = (schedule) => {
      schedule.call(() => gate).withoutOverlapping();
      schedule.call(() => { ran.push('b'); }).withoutOverlapping();
      return schedule;
    };

    // First cron run is still inside task A when the next run starts.
    const first = define(new ScheduleManager(app)).runDue();
    await new Promise((r) => setImmediate(r));
    await define(new ScheduleManager(app)).runDue();
    assert.deepEqual(ran, ['b']);

    release();
    await first;
  });

  it('job() dispatches an instance built with the payload', async () => {
    const { app, dispatched } = scheduleApp();
    const schedule = new ScheduleManager(app);
    class PruneJob {
      constructor(_app, data) { Object.assign(this, data); }
    }
    schedule.job(PruneJob, { days: 30 });

    await schedule.runDue();
    assert.equal(dispatched.length, 1);
    assert.ok(dispatched[0] instanceof PruneJob);
    assert.equal(dispatched[0].days, 30);
  });
});
