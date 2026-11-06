import { randomBytes } from 'node:crypto';

/**
 * Cache lock — prevents race conditions (Taand Cache::lock equivalent).
 */
export class CacheLock {
  constructor(driver, key, seconds, owner) {
    this.#driver = driver;
    this.#key = `__lock:${key}`;
    this.#seconds = seconds;
    this.#owner = owner ?? randomBytes(16).toString('hex');
  }

  #driver;
  #key;
  #seconds;
  #owner;
  #acquired = false;

  async get(blockSeconds = 0) {
    const deadline = Date.now() + blockSeconds * 1000;

    while (true) {
      const acquired = await this.#driver.add(this.#key, this.#owner, this.#seconds);
      if (acquired) {
        this.#acquired = true;
        return true;
      }

      if (blockSeconds <= 0 || Date.now() >= deadline) return false;
      await new Promise((r) => setTimeout(r, 50));
    }
  }

  async release() {
    if (!this.#acquired) return false;
    // Check-and-delete must be one driver step: the lock may expire and be re-acquired in between.
    const released = await this.#driver.forgetIf(this.#key, this.#owner);
    if (released) this.#acquired = false;
    return released;
  }

  owner() {
    return this.#owner;
  }
}
