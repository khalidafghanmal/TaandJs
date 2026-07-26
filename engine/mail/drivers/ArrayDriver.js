/**
 * Stores sent mail in memory — perfect for tests and the dev dashboard.
 */
export class ArrayDriver {
  constructor() {
    this.#sent = [];
  }

  #sent;

  async send(message, raw) {
    const record = {
      id: `mail_${Date.now()}_${this.#sent.length}`,
      sentAt: new Date().toISOString(),
      message,
      raw,
    };
    this.#sent.push(record);
    return { id: record.id, driver: 'array' };
  }

  all() {
    return [...this.#sent];
  }

  find(id) {
    return this.#sent.find((m) => m.id === id) ?? null;
  }

  flush() {
    this.#sent.length = 0;
  }
}
