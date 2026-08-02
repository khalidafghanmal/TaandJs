const DEFAULT_SENSITIVE = [
  'password',
  'password_confirmation',
  'current_password',
  'new_password',
  'token',
  'secret',
  'api_key',
  'apikey',
  'authorization',
  'cookie',
  'credit_card',
  'card_number',
  'cvv',
  'ssn',
  'private_key',
  'access_token',
  'refresh_token',
  'remember_token',
];

const SENSITIVE_RE = new RegExp(
  `(${DEFAULT_SENSITIVE.join('|')}|pass(word)?|auth|key|secret|token)`,
  'i',
);

const REDACTED = '[REDACTED]';

/**
 * Strips sensitive values from log context — prevents credential leaks in log files.
 */
export class LogSanitizer {
  constructor(extraKeys = []) {
    this.#keys = new Set([...DEFAULT_SENSITIVE, ...extraKeys].map((k) => k.toLowerCase()));
  }

  #keys;

  sanitize(value, depth = 0) {
    if (depth > 8) return '[TRUNCATED]';
    if (value === null || value === undefined) return value;

    if (value instanceof Error) {
      return {
        name: value.name,
        message: value.message,
        code: value.code ?? undefined,
        status: value.status ?? undefined,
        stack: value.stack,
      };
    }

    if (Array.isArray(value)) {
      return value.map((item) => this.sanitize(item, depth + 1));
    }

    if (typeof value === 'object') {
      const next = {};
      for (const [key, item] of Object.entries(value)) {
        next[key] = this.#isSensitive(key) ? REDACTED : this.sanitize(item, depth + 1);
      }
      return next;
    }

    if (typeof value === 'string' && value.length > 4096) {
      return `${value.slice(0, 4096)}…[truncated]`;
    }

    return value;
  }

  #isSensitive(key) {
    const lower = key.toLowerCase();
    if (this.#keys.has(lower)) return true;
    return SENSITIVE_RE.test(lower);
  }
}
