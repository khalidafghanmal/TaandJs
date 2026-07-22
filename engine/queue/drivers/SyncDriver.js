/**
 * Runs jobs immediately — no persistence.
 */
export class SyncDriver {
  constructor(runner) {
    this.#runner = runner;
  }

  #runner;

  async push(record) {
    await this.#runner(record);
    return record.id ?? 'sync';
  }

  async pop() {
    return null;
  }

  async delete() {}

  async release() {}

  size() {
    return 0;
  }

  all() {
    return [];
  }
}
