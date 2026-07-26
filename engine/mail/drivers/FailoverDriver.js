/**
 * Tries mailers in order until one succeeds.
 */
export class FailoverDriver {
  constructor(drivers = []) {
    this.#drivers = drivers;
  }

  #drivers;

  async send(message, raw) {
    const errors = [];

    for (const driver of this.#drivers) {
      try {
        return await driver.send(message, raw);
      } catch (err) {
        errors.push(err.message);
      }
    }

    throw new Error(`[Taand] All mailers failed: ${errors.join(' | ')}`);
  }
}
