/**
 * Date helper — tick(), today()
 */
export class Tick {
  constructor(date = new Date()) {
    this.date = date instanceof Date ? new Date(date.getTime()) : new Date(date);
  }

  static make(date) {
    return new Tick(date);
  }

  addDays(days) {
    const next = new Date(this.date);
    next.setDate(next.getDate() + days);
    return new Tick(next);
  }

  addHours(hours) {
    const next = new Date(this.date);
    next.setHours(next.getHours() + hours);
    return new Tick(next);
  }

  toDate() {
    return new Date(this.date.getTime());
  }

  toISO() {
    return this.date.toISOString();
  }

  format(locale = 'en-US', options = {}) {
    return new Intl.DateTimeFormat(locale, options).format(this.date);
  }
}

export function tick(date = new Date()) {
  return Tick.make(date);
}

export function today() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return new Tick(d);
}
