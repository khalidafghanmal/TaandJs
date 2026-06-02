/**
 * Run a side effect and return the original value unchanged.
 */
export function tap(value, fn) {
  if (typeof fn === 'function') {
    fn(value);
  }
  return value;
}
