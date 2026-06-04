import crypto from 'node:crypto';

/**
 * Constant-time string comparison — avoids timing leaks on API tokens and secrets.
 */
export function secureCompare(a, b) {
  const left = Buffer.from(String(a ?? ''), 'utf8');
  const right = Buffer.from(String(b ?? ''), 'utf8');
  if (left.length !== right.length) {
    return false;
  }
  return crypto.timingSafeEqual(left, right);
}
