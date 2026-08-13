import { safeBack } from '../engine/support/SafeBack.js';
import { currentRequest } from '../engine/support/RequestContext.js';

/**
 * Redirect to same-origin Referer or fallback — open-redirect safe.
 */
export default function back(request = null, fallback = '/') {
  const req = request ?? currentRequest();
  return safeBack(req, fallback);
}
