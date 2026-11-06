import { normalizeEventName, isWildcard, matchesWildcard } from './EventName.js';
import { ListenerResolver } from './ListenerResolver.js';

class ListenerEntry {
  constructor(handler, { event, priority = 0, async = false, once = false, wildcard = null } = {}) {
    this.event = event;
    this.handler = handler;
    this.raw = handler;
    this.priority = priority;
    this.async = async;
    this.once = once;
    this.wildcard = wildcard;
    this.resolved = typeof handler === 'function' && !this.#isClass(handler);
    this.active = true;
  }

  #isClass(fn) {
    return typeof fn === 'function' && fn.prototype && fn.prototype.constructor === fn;
  }
}

/**
 * Event dispatcher — Taand's Illuminate\Events\Dispatcher equivalent.
 */
export class EventDispatcher {
  constructor(app) {
    this.app = app;
    this.#resolver = new ListenerResolver(app);
    this.#listeners = new Map();
    this.#wildcards = [];
    this.#config = () => app.make('config').get('events', {});
  }

  #resolver;
  #listeners;
  #wildcards;
  #config;

  listen(event, listener, options = {}) {
    const name = normalizeEventName(event);
    this.#assertListenerLimit(name);

    const entry = new ListenerEntry(listener, {
      ...options,
      event: name,
      wildcard: isWildcard(name) ? name : null,
    });

    if (isWildcard(name)) {
      this.#wildcards.push({ pattern: name, entry });
      this.#wildcards.sort((a, b) => b.entry.priority - a.entry.priority);
      return () => this.#remove(entry);
    }

    if (!this.#listeners.has(name)) {
      this.#listeners.set(name, []);
    }

    const list = this.#listeners.get(name);
    list.push(entry);
    list.sort((a, b) => b.priority - a.priority);

    return () => this.#remove(entry);
  }

  async subscribe(SubscriberClass) {
    const subscriber = new SubscriberClass(this.app);
    if (typeof subscriber.subscribe !== 'function') {
      throw new Error(`[Taand] Event subscriber [${SubscriberClass.name}] must implement subscribe(dispatcher)`);
    }
    await subscriber.subscribe(this);
    return subscriber;
  }

  hasListeners(event) {
    const name = normalizeEventName(event);
    if (this.#listeners.get(name)?.some((e) => e.active)) return true;
    return this.#wildcards.some((w) => w.entry.active && matchesWildcard(w.pattern, name));
  }

  forget(event) {
    const name = normalizeEventName(event);
    this.#listeners.delete(name);
    this.#wildcards = this.#wildcards.filter((w) => w.pattern !== name);
  }

  async dispatch(event, payload = undefined) {
    const eventName = normalizeEventName(event);
    const eventObject = this.#eventPayload(event, payload);
    const results = [];

    for (const entry of this.#collectListeners(eventName)) {
      const result = await this.#runListener(entry, eventName, eventObject);
      if (result === false || eventObject?.isHalted?.()) break;
      if (result !== undefined) results.push(result);
    }

    return results;
  }

  async until(event, payload = undefined) {
    const eventName = normalizeEventName(event);
    const eventObject = this.#eventPayload(event, payload);

    for (const entry of this.#collectListeners(eventName)) {
      const result = await this.#runListener(entry, eventName, eventObject);
      if (result !== null && result !== undefined) return result;
    }

    return null;
  }

  #eventPayload(event, payload) {
    if (typeof event === 'object' && event !== null) return event;
    return payload;
  }

  #collectListeners(eventName) {
    const entries = [...(this.#listeners.get(eventName) ?? [])].filter((e) => e.active);

    for (const { pattern, entry } of this.#wildcards) {
      if (entry.active && matchesWildcard(pattern, eventName)) {
        entries.push(entry);
      }
    }

    return entries.sort((a, b) => b.priority - a.priority);
  }

  async #runListener(entry, eventName, eventObject) {
    if (!entry.active) return undefined;
    // Remove before any await so a concurrent dispatch cannot run it a second time.
    if (entry.once) this.#remove(entry);

    try {
      if (!entry.resolved) {
        entry.handler = await this.#resolver.resolve(entry.raw);
        entry.resolved = true;
      }

      if (entry.async) {
        setImmediate(() => {
          this.#invoke(entry, eventName, eventObject).catch((err) => {
            this.#handleListenerError(eventName, err);
          });
        });
        return undefined;
      }

      return await this.#invoke(entry, eventName, eventObject);
    } catch (error) {
      await this.#handleListenerError(eventName, error);
      if (this.#config().stopOnFailure) throw error;
      return undefined;
    }
  }

  async #invoke(entry, eventName, eventObject) {
    if (entry.wildcard) {
      return entry.handler(eventName, eventObject);
    }
    return entry.handler(eventObject);
  }

  async #handleListenerError(eventName, error) {
    if (this.app.has('log')) {
      this.app.make('log').error('Event listener failed', { event: eventName, error });
      await this.app.make('log').flush?.();
      return;
    }

    if (this.app.debug) {
      console.error(`[Taand] Event listener failed for [${eventName}]`, error);
    }
  }

  #assertListenerLimit(eventName) {
    const max = this.#config().maxListeners ?? 100;
    const count = (this.#listeners.get(eventName)?.length ?? 0)
      + this.#wildcards.filter((w) => w.pattern === eventName).length;

    if (count >= max) {
      throw new Error(`[Taand] Max listeners (${max}) exceeded for event [${eventName}]`);
    }
  }

  #remove(entry) {
    entry.active = false;

    if (entry.wildcard) {
      this.#wildcards = this.#wildcards.filter((w) => w.entry !== entry);
      return;
    }

    const list = this.#listeners.get(entry.event);
    const index = list?.indexOf(entry) ?? -1;
    if (index === -1) return;
    list.splice(index, 1);
    if (list.length === 0) this.#listeners.delete(entry.event);
  }
}
