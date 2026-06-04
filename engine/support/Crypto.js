import crypto from 'node:crypto';

const MIN_TOKEN_BYTES = 16;

/**
 * Cryptographically secure identifiers — use for tokens, reset links, API keys.
 */
export function uuid() {
  return crypto.randomUUID();
}

export function token(bytes = 32) {
  const size = Number(bytes);
  if (!Number.isFinite(size) || size < MIN_TOKEN_BYTES) {
    throw new Error(`[Taand] token() requires at least ${MIN_TOKEN_BYTES} bytes of entropy`);
  }
  return crypto.randomBytes(size).toString('base64url');
}

token.urlSafe = function urlSafe(length = 32) {
  const bytes = Math.max(MIN_TOKEN_BYTES, Math.ceil(Number(length) / 2) || MIN_TOKEN_BYTES);
  return token(bytes).slice(0, length);
};
