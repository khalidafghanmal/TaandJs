import session from './session.js';
import { currentRequest } from '../engine/support/RequestContext.js';
import { formErrorsFromFlash } from '../engine/support/FormErrors.js';

/**
 * First validation error for a field — or all errors when field omitted.
 */
export default function errors(request = null, field = null) {
  const req = request ?? currentRequest();
  if (!req) return field ? null : {};

  const flashOld = session.for(req).get('_flash.old', {});
  return formErrorsFromFlash(flashOld, field);
}
