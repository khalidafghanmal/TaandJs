const UNSAFE_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
const SAFE_CLASS = /^[a-zA-Z0-9_-]+$/;

/**
 * View form helpers — classNames, selected, checked (security-hardened).
 */
export function classNames(input) {
  if (typeof input === 'string') {
    return sanitizeClassList(input.split(/\s+/));
  }

  if (!input || typeof input !== 'object') return '';

  const parts = [];
  for (const [name, active] of Object.entries(input)) {
    if (!active) continue;
    if (!SAFE_CLASS.test(name)) continue;
    parts.push(name);
  }

  return parts.join(' ');
}

export function selected(field, value, current) {
  if (field != null && value == null && current === undefined) {
    current = field;
    field = null;
  }
  return String(current) === String(value) ? 'selected' : '';
}

export function checked(field, value, current) {
  if (field != null && value == null && current === undefined) {
    current = field;
    field = null;
  }

  if (Array.isArray(current)) {
    return current.map(String).includes(String(value)) ? 'checked' : '';
  }

  return String(current) === String(value) || current === true || current === 'on'
    ? 'checked'
    : '';
}

function sanitizeClassList(names) {
  return names.filter((name) => name && SAFE_CLASS.test(name)).join(' ');
}

export function safeFieldKey(key) {
  if (typeof key !== 'string' || UNSAFE_KEYS.has(key)) return null;
  return key;
}
