import { Redirect } from '../http/Redirect.js';

/**
 * Safe relative back URL from Referer — open-redirect hardened.
 */
export function safeBackPath(request, fallback = '/') {
  const safeFallback = sanitizeRelative(fallback, '/');
  if (!request) return safeFallback;

  const referer = request.header('referer');
  if (!referer || typeof referer !== 'string') return safeFallback;

  let parsed;
  try {
    parsed = new URL(referer);
  } catch {
    return safeFallback;
  }

  const requestHost = normalizeHost(request.header('host'));
  const refererHost = normalizeHost(parsed.host);

  if (!requestHost || !refererHost || requestHost !== refererHost) {
    return safeFallback;
  }

  if (referer.includes('..') || referer.includes('\\')) {
    return safeFallback;
  }

  const path = `${parsed.pathname}${parsed.search}`;
  return sanitizeRelative(path, safeFallback);
}

export function safeBack(request, fallback = '/') {
  return Redirect.to(safeBackPath(request, fallback));
}

function sanitizeRelative(path, fallback) {
  try {
    return Redirect.sanitize(path);
  } catch {
    try {
      return Redirect.sanitize(fallback);
    } catch {
      return '/';
    }
  }
}

function normalizeHost(host) {
  if (!host || typeof host !== 'string') return null;
  return host.trim().toLowerCase().split(':')[0];
}
