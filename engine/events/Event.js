/**
 * Base event class — extend for typed domain events.
 */
export class Event {
  #halted = false;

  halt() {
    this.#halted = true;
  }

  isHalted() {
    return this.#halted;
  }
}
