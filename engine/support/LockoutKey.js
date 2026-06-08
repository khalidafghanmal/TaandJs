/**
 * Credential lockout key — email (or username) + client IP.
 */
export function lockoutKey(identity, ip = 'unknown') {
  const normalized = String(identity ?? '').trim().toLowerCase();
  return `attempt:${normalized}|${ip}`;
}

export function lockoutKeyFromRequest(request, field = 'email') {
  const identity = request?.input?.(field) ?? '';
  const ip = request?.ip?.() ?? 'unknown';
  return lockoutKey(identity, ip);
}
