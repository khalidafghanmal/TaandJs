import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scryptAsync = promisify(scrypt);

// Parameters of the original 4-part format, which did not record them.
const LEGACY_PARAMS = { N: 16384, r: 8, p: 1 };

/**
 * Password hashing — Node scrypt (no extra dependencies).
 * Format: $scrypt$N=32768,r=8,p=3$base64salt$base64hash
 * Legacy: $scrypt$base64salt$base64hash (N=16384, r=8, p=1) — still verifies.
 */
export class Hasher {
  constructor(options = {}) {
    // OWASP Password Storage Cheat Sheet: N=2^15, r=8, p=3 (32 MiB per hash).
    this.#options = {
      N: 32768,
      r: 8,
      p: 3,
      keyLength: 64,
      ...options,
    };
  }

  #options;

  async hash(password) {
    if (typeof password !== 'string' || !password) {
      throw new TypeError('[Taand] Password must be a non-empty string');
    }

    const { N, r, p, keyLength } = this.#options;
    const salt = randomBytes(16);
    const derived = await derive(password, salt, keyLength, { N, r, p });

    return `$scrypt$N=${N},r=${r},p=${p}$${salt.toString('base64')}$${derived.toString('base64')}`;
  }

  async verify(password, stored) {
    if (typeof password !== 'string' || !password) {
      return false;
    }

    const parsed = Hasher.#parse(stored);
    if (!parsed) return false;

    try {
      const derived = await derive(password, parsed.salt, parsed.key.length, parsed.params);
      if (derived.length !== parsed.key.length) return false;
      return timingSafeEqual(derived, parsed.key);
    } catch {
      return false;
    }
  }

  needsRehash(stored) {
    const parsed = Hasher.#parse(stored);
    if (!parsed) return true;

    const { N, r, p, keyLength } = this.#options;
    return parsed.params.N !== N
      || parsed.params.r !== r
      || parsed.params.p !== p
      || parsed.key.length !== keyLength;
  }

  /** A well-formed hash at the current cost — verify it for unknown users so timing matches. */
  get dummyHash() {
    const { N, r, p, keyLength } = this.#options;
    const zeros = (size) => Buffer.alloc(size).toString('base64');
    return `$scrypt$N=${N},r=${r},p=${p}$${zeros(16)}$${zeros(keyLength)}`;
  }

  async hashToken() {
    const token = randomBytes(32).toString('hex');
    const hash = await this.hash(token);
    return { token, hash };
  }

  static #parse(stored) {
    if (typeof stored !== 'string') return null;

    const parts = stored.split('$');
    if (parts[1] !== 'scrypt') return null;

    let params = LEGACY_PARAMS;
    let encoded = parts.slice(2);

    if (parts.length === 5) {
      const match = /^N=(\d+),r=(\d+),p=(\d+)$/.exec(parts[2]);
      if (!match) return null;
      params = { N: Number(match[1]), r: Number(match[2]), p: Number(match[3]) };
      encoded = parts.slice(3);
    } else if (parts.length !== 4) {
      return null;
    }

    return {
      params,
      salt: Buffer.from(encoded[0], 'base64'),
      key: Buffer.from(encoded[1], 'base64'),
    };
  }
}

function derive(password, salt, keyLength, { N, r, p }) {
  // N=2^15, r=8 needs exactly 32 MiB plus overhead, just over Node's default maxmem.
  return scryptAsync(password, salt, keyLength, { N, r, p, maxmem: 256 * N * r });
}
