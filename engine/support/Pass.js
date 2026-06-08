/**
 * pass({ user, title }) — safe view data (named fields, no eval).
 * Strips sensitive fields, blocks prototype keys, returns plain JSON-safe values.
 */

export const UNSAFE_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

export const SENSITIVE_KEYS = new Set([
  'password',
  'passwordHash',
  'passwordConfirmation',
  'currentPassword',
  'newPassword',
  'rememberToken',
  'apiToken',
  'plainTextToken',
  'accessToken',
  'refreshToken',
  'secret',
  'twoFactorSecret',
  'recoveryCodes',
  'privateKey',
  'tokenHash',
]);

const DEFAULT_DEPTH = 8;

/**
 * @param {Record<string, unknown>} data
 * @param {{ only?: string[], except?: string[], keys?: Record<string, string[]>, depth?: number }} [options]
 */
export function pass(data, options = {}) {
  if (data == null || typeof data !== 'object' || Array.isArray(data)) {
    throw new TypeError('[pass] Expected a plain object, e.g. pass({ user, title })');
  }

  const out = {};
  const perKey = options.keys ?? {};
  const maxDepth = options.depth ?? DEFAULT_DEPTH;
  const extraExcept = options.except ?? [];

  for (const key of Object.keys(data)) {
    if (UNSAFE_KEYS.has(key)) continue;

    const allow = Object.hasOwn(perKey, key) ? perKey[key] : options.only;
    out[key] = sanitize(data[key], {
      only: allow,
      except: extraExcept,
      maxDepth,
    }, 0);
  }

  return out;
}

function sanitize(value, opts, depth) {
  if (depth > opts.maxDepth) return null;

  if (value == null) return value;
  if (typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'bigint') return value.toString();

  if (value instanceof Date) return value.toISOString();

  if (Array.isArray(value)) {
    return value.map((item) => sanitize(item, opts, depth + 1));
  }

  if (typeof value === 'object') {
    return sanitizeObject(value, opts, depth);
  }

  return null;
}

function sanitizeObject(obj, opts, depth) {
  const out = {};
  const only = Array.isArray(opts.only) ? new Set(opts.only) : null;
  const extraExcept = new Set(opts.except ?? []);

  for (const key of Object.keys(obj)) {
    if (UNSAFE_KEYS.has(key)) continue;
    if (SENSITIVE_KEYS.has(key) || extraExcept.has(key)) continue;
    if (only && !only.has(key)) continue;

    out[key] = sanitize(obj[key], opts, depth + 1);
  }

  return out;
}

export default pass;
