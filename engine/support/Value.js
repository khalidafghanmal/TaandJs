/**
 * Value checks — none(), some(), maybe()
 */
export function none(value) {
  if (value === null || value === undefined) return true;
  if (typeof value === 'string') return value.trim() === '';
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === 'object') return Object.keys(value).length === 0;
  return false;
}

export function some(value) {
  return !none(value);
}

export function maybe(value) {
  const chain = {
    get(key, fallback = null) {
      return value?.[key] ?? fallback;
    },
    call(fn, ...args) {
      if (value == null) return null;
      return fn(value, ...args);
    },
    or(fallback) {
      return value ?? fallback;
    },
    map(fn) {
      return value == null ? null : fn(value);
    },
    when(condition, fn) {
      if (value == null) return null;
      const pass = typeof condition === 'function' ? condition(value) : Boolean(condition);
      return pass ? (typeof fn === 'function' ? fn(value) : fn) : value;
    },
    unless(condition, fn) {
      const pass = typeof condition === 'function' ? condition(value) : Boolean(condition);
      return pass ? value : (typeof fn === 'function' ? fn(value) : fn);
    },
    tap(fn) {
      if (value != null && typeof fn === 'function') fn(value);
      return chain;
    },
    value() {
      return value;
    },
  };

  return chain;
}
