export class NullDriver {
  async send() {
    return { id: null, driver: 'null' };
  }
}
