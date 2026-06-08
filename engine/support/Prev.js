/**
 * Read flashed form input after validation redirect — prev('email')
 */
export function prevFromOld(oldInput, key, fallback = '') {
  if (!oldInput || typeof oldInput !== 'object') return fallback;
  if (key == null || key === '') return oldInput;
  const value = oldInput[key];
  return value === undefined || value === null ? fallback : value;
}
