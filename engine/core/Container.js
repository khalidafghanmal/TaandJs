/**
 * Lightweight IoC container — Taand Container inspired.
 * Supports bind, singleton, and lazy resolution for scalability.
 */
export class Container {
  #bindings = new Map();
  #instances = new Map();

  bind(key, factory) {
    this.#bindings.set(key, { factory, singleton: false });
    return this;
  }

  singleton(key, factory) {
    this.#bindings.set(key, { factory, singleton: true });
    return this;
  }

  instance(key, value) {
    this.#instances.set(key, value);
    return this;
  }

  has(key) {
    return this.#instances.has(key) || this.#bindings.has(key);
  }

  resolve(key) {
    if (this.#instances.has(key)) {
      return this.#instances.get(key);
    }

    const binding = this.#bindings.get(key);
    if (!binding) {
      throw new Error(`[Taand] Service not bound: ${String(key)}`);
    }

    const resolved = binding.factory(this);

    if (binding.singleton) {
      this.#instances.set(key, resolved);
    }

    return resolved;
  }

  make(key) {
    return this.resolve(key);
  }
}
