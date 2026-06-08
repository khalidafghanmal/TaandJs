import { prevFromOld } from './Prev.js';

const UNSAFE_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

/**
 * Read flashed validation errors from session flash bag.
 */
export function formErrorsFromFlash(flashOld, field = null) {
  const errors = flashOld?.errors ?? {};
  if (field == null || field === '') {
    return errors;
  }

  if (typeof field !== 'string' || UNSAFE_KEYS.has(field)) {
    return null;
  }

  const messages = errors[field];
  if (Array.isArray(messages)) {
    return messages[0] ?? null;
  }

  return messages ?? null;
}

export function formErrorsFromSession(sessionStore, request, field = null) {
  if (!sessionStore || !request) return field ? null : {};

  const session = request.attribute?.('_session');
  if (!session) return field ? null : {};

  const flashOld = sessionStore.get(session, '_flash.old', {});
  return formErrorsFromFlash(flashOld, field);
}

export { prevFromOld };
