import { app } from './app.js';
import { currentRequest } from '../engine/support/RequestContext.js';
import { HttpError } from '../engine/http/HttpError.js';
import { lockoutKey, lockoutKeyFromRequest } from '../engine/support/LockoutKey.js';

function limiter() {
  return app.make('rateLimiter');
}

/**
 * Brute-force / login attempt limiter — Taand RateLimiter equivalent.
 *
 *   if (await attempt.tooMany(key, 3)) fail(429, 'Locked');
 *   await attempt.hit(key, 300);
 *   await attempt.clear(key);
 */
export async function tooMany(key, maxAttempts) {
  return limiter().tooManyAttempts(key, maxAttempts);
}

export async function count(key) {
  return limiter().attempts(key);
}

export async function hit(key, decaySeconds = 60) {
  return limiter().hit(key, decaySeconds);
}

export async function clear(key) {
  return limiter().clear(key);
}

export async function retryIn(key, decaySeconds = 60) {
  return limiter().availableIn(key, decaySeconds);
}

export async function remaining(key, maxAttempts) {
  return limiter().remaining(key, maxAttempts);
}

/** Build a lockout key — identity + IP (email field by default). */
export function key(email, ip = 'unknown') {
  return lockoutKey(email, ip);
}

/** Build key from current or given request. */
export function keyFromRequest(request = null, field = 'email') {
  const req = request ?? currentRequest();
  return lockoutKeyFromRequest(req, field);
}

/** Throw 429 when the limit is already exceeded. */
export async function ensure(key, maxAttempts, decaySeconds = 60) {
  if (!(await tooMany(key, maxAttempts))) return;

  const seconds = await retryIn(key, decaySeconds);
  const message = seconds > 0
    ? `Too many attempts. Try again in ${seconds} seconds.`
    : 'Too many attempts. Please try again later.';

  const error = HttpError.tooManyRequests(message);
  error.retryAfter = seconds;
  throw error;
}

const attempt = {
  tooMany,
  count,
  hit,
  clear,
  retryIn,
  remaining,
  key,
  keyFromRequest,
  ensure,
};

export default attempt;
