import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ScheduledEvent } from '../engine/schedule/ScheduleManager.js';

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
