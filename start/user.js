import { currentRequest } from '../engine/support/RequestContext.js';

/**
 * Current authenticated user (public fields only) — null when guest.
 */
export default function user(request = null) {
  const req = request ?? currentRequest();
  if (!req) return null;
  return req.attribute('_user') ?? null;
}
