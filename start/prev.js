import session from './session.js';
import { prevFromOld } from '../engine/support/Prev.js';

/**
 * Previous form input after validation — prev(req, 'email')
 */
export default function prev(request, key, fallback = '') {
  const flashOld = session.for(request).get('_flash.old', {});
  const oldInput = flashOld?.old ?? {};
  return prevFromOld(oldInput, key, fallback);
}

export { prevFromOld };
