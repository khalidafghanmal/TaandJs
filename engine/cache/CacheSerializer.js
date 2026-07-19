import crypto from 'node:crypto';

/**
 * Safe JSON serialization — no eval, no unsafe unserialize.
 */
export function serializeValue(value) {
  return JSON.stringify(value);
}

export function deserializeValue(raw) {
  if (raw === null || raw === undefined || raw === '') return undefined;
  return JSON.parse(raw);
}

export function hashKey(key) {
  return crypto.createHash('sha256').update(String(key)).digest('hex');
}

export function ttlToExpiry(ttlSeconds) {
  if (ttlSeconds === null || ttlSeconds === undefined) return null;
  if (ttlSeconds <= 0) return Date.now();
  return Date.now() + ttlSeconds * 1000;
}

export function isExpired(expiresAt) {
  return expiresAt !== null && expiresAt !== undefined && Date.now() >= expiresAt;
}
