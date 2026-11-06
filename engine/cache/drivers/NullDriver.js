export class NullDriver {
  async get() { return undefined; }
  async put() { return true; }
  async add() { return true; }
  async forget() { return true; }
  async forgetIf() { return true; }
  async flush() { return true; }
  async increment() { return 0; }
  async keys() { return []; }
  async stats() { return { entries: 0, bytes: 0 }; }
}
