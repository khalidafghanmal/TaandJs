export class NullDriver {
  async push() {
    return null;
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
