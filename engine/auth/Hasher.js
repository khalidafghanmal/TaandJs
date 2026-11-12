import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scryptAsync = promisify(scrypt);
const MIN_KEY_BYTES = 16;

/**
 * Password hashing — Node scrypt (no extra dependencies).
 * Format: $scrypt$base64salt$base64hash
 */
export class Hasher {
  constructor(options = {}) {
    this.#options = {
      N: 16384,
      r: 8,
      p: 1,
      keyLength: 64,
      ...options,
    };
  }

  #options;

  async hash(password) {
    if (typeof password !== 'string' || !password) {
      throw new TypeError('[Taand] Password must be a non-empty string');
    }

    const salt = randomBytes(16);
    const derived = await scryptAsync(password, salt, this.#options.keyLength, {
      N: this.#options.N,
      r: this.#options.r,
      p: this.#options.p,
    });

    return `$scrypt$${salt.toString('base64')}$${derived.toString('base64')}`;
  }

  async verify(password, stored) {
    if (typeof password !== 'string' || !password || typeof stored !== 'string') {
      return false;
    }

    const parts = stored.split('$');
    if (parts.length !== 4 || parts[1] !== 'scrypt') {
      return false;
    }

    try {
      const salt = Buffer.from(parts[2], 'base64');
      const expected = Buffer.from(parts[3], 'base64');
      // An empty key would make timingSafeEqual(empty, empty) accept any password.
      if (expected.length < MIN_KEY_BYTES) return false;

      const derived = await scryptAsync(password, salt, expected.length, {
        N: this.#options.N,
        r: this.#options.r,
        p: this.#options.p,
      });

      if (derived.length !== expected.length) return false;
      return timingSafeEqual(derived, expected);
    } catch {
      return false;
    }
  }

  async hashToken() {
    const token = randomBytes(32).toString('hex');
    const hash = await this.hash(token);
    return { token, hash };
  }
}
