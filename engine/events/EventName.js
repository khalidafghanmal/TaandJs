const EVENT_NAME_RE = /^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/i;
const CLASS_NAME_RE = /^[A-Z][A-Za-z0-9]*$/;
const SAFE_METHODS = new Set(['handle', 'listen', '__invoke']);
const BLOCKED_METHODS = new Set(['constructor', 'prototype', '__proto__']);

/**
 * Normalizes and validates event identifiers.
 */
export function normalizeEventName(event) {
  if (typeof event === 'function') {
    const name = event.name;
    if (!name || name === 'default') {
      throw new Error('[Taand] Event classes must be named');
    }
    return name;
  }

  if (typeof event === 'object' && event !== null) {
    const name = event.constructor?.name;
    if (!name || name === 'Object') {
      throw new Error('[Taand] Event objects must use a named class');
    }
    return name;
  }

  if (typeof event === 'string') {
    if (event === '*') return '*';
    if (event.endsWith('.*')) {
      const base = event.slice(0, -2);
      if (!EVENT_NAME_RE.test(base)) {
        throw new Error(`[Taand] Invalid wildcard event name: ${event}`);
      }
      return event;
    }
    if (!EVENT_NAME_RE.test(event)) {
      throw new Error(`[Taand] Invalid event name: ${event}`);
    }
    return event;
  }

  throw new Error('[Taand] Event must be a string, class, or event object');
}

export function isWildcard(name) {
  return name === '*' || name.endsWith('.*');
}

export function matchesWildcard(pattern, eventName) {
  if (pattern === '*') return true;
  if (pattern.endsWith('.*')) {
    const prefix = pattern.slice(0, -2);
    return eventName === prefix || eventName.startsWith(`${prefix}.`);
  }
  return pattern === eventName;
}

export function validateListenerMethod(method) {
  if (!method || BLOCKED_METHODS.has(method) || method.startsWith('_')) {
    throw new Error(`[Taand] Listener method [${method}] is not allowed`);
  }
  return method;
}

export function validateClassName(name) {
  if (!CLASS_NAME_RE.test(name)) {
    throw new Error(`[Taand] Invalid listener class [${name}]`);
  }
  return name;
}

export function parseListenerString(listener) {
  if (typeof listener !== 'string' || !listener.includes('@')) {
    throw new Error(`[Taand] Invalid listener string: ${listener}`);
  }

  const [className, method] = listener.split('@');
  validateClassName(className);
  validateListenerMethod(method);
  return { className, method };
}

export { SAFE_METHODS, CLASS_NAME_RE };
