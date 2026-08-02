export class StackDriver {
  constructor(drivers = []) {
    this.#drivers = drivers;
  }

  #drivers;

  write(record) {
    for (const driver of this.#drivers) {
      driver.write(record);
    }
  }

  flush() {
    return Promise.all(this.#drivers.map((driver) => driver.flush?.() ?? Promise.resolve()));
  }
}
