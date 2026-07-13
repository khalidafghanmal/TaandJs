import crypto from 'node:crypto';
import { token as generateSecret } from '../support/Crypto.js';

/**
 * Personal access tokens — Sanctum-style per-user API tokens.
 * Format: {id}|{plainTextSecret} — secret stored as SHA-256 hash only.
 */
export class PersonalAccessTokenManager {
  constructor(app) {
    this.app = app;
  }

  #db() {
    return this.app.make('db');
  }

  #config() {
    return this.app.make('config').get('auth.tokens', {});
  }

  async create(userId, name, abilities = ['*'], expiresAt = null) {
    const id = Number(userId);
    if (!Number.isInteger(id) || id < 1) {
      throw new TypeError('[Taand] createToken() requires a valid user id');
    }

    const label = String(name ?? '').trim();
    if (!label) {
      throw new TypeError('[Taand] createToken() requires a token name');
    }

    const secret = generateSecret(32);
    const prefix = this.#config().prefix ?? '';
    const plainText = `${prefix}${secret}`;
    const hash = PersonalAccessTokenManager.#hashSecret(plainText);
    const abilityList = PersonalAccessTokenManager.#normalizeAbilities(abilities);

    const record = await this.#db().personalAccessToken.create({
      data: {
        userId: id,
        name: label,
        token: hash,
        abilities: JSON.stringify(abilityList),
        expiresAt,
      },
    });

    return {
      id: record.id,
      name: record.name,
      abilities: abilityList,
      expiresAt: record.expiresAt,
      plainTextToken: `${record.id}|${plainText}`,
    };
  }

  async findUserByCredential(credential) {
    const parsed = PersonalAccessTokenManager.#parseCredential(credential);
    if (!parsed) return null;

    const record = await this.#db().personalAccessToken.findUnique({
      where: { id: parsed.id },
      include: { user: true },
    });

    if (!record?.user) return null;

    const expected = Buffer.from(record.token, 'hex');
    const provided = Buffer.from(PersonalAccessTokenManager.#hashSecret(parsed.secret), 'hex');

    if (expected.length !== provided.length) return null;
    if (!crypto.timingSafeEqual(expected, provided)) return null;

    if (record.expiresAt && record.expiresAt.getTime() <= Date.now()) {
      return null;
    }

    await this.#db().personalAccessToken.update({
      where: { id: record.id },
      data: { lastUsedAt: new Date() },
    });

    return {
      token: {
        id: record.id,
        name: record.name,
        abilities: PersonalAccessTokenManager.#parseAbilities(record.abilities),
        lastUsedAt: new Date(),
        expiresAt: record.expiresAt,
      },
      user: record.user,
    };
  }

  async revoke(tokenId, userId = null) {
    const id = Number(tokenId);
    if (!Number.isInteger(id) || id < 1) return false;

    const where = { id };
    if (userId != null) {
      where.userId = Number(userId);
    }

    try {
      await this.#db().personalAccessToken.delete({ where });
      return true;
    } catch {
      return false;
    }
  }

  async revokeAll(userId) {
    const id = Number(userId);
    if (!Number.isInteger(id) || id < 1) return 0;

    const result = await this.#db().personalAccessToken.deleteMany({ where: { userId: id } });
    return result.count;
  }

  async listForUser(userId) {
    const id = Number(userId);
    if (!Number.isInteger(id) || id < 1) return [];

    const rows = await this.#db().personalAccessToken.findMany({
      where: { userId: id },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        abilities: true,
        lastUsedAt: true,
        expiresAt: true,
        createdAt: true,
      },
    });

    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      abilities: PersonalAccessTokenManager.#parseAbilities(row.abilities),
      lastUsedAt: row.lastUsedAt,
      expiresAt: row.expiresAt,
      createdAt: row.createdAt,
    }));
  }

  tokenCan(tokenMeta, ability) {
    if (!tokenMeta?.abilities?.length) return false;
    if (tokenMeta.abilities.includes('*')) return true;
    return tokenMeta.abilities.includes(ability);
  }

  static #hashSecret(secret) {
    return crypto.createHash('sha256').update(String(secret)).digest('hex');
  }

  static #parseCredential(credential) {
    if (typeof credential !== 'string' || !credential.includes('|')) return null;

    const pipe = credential.indexOf('|');
    const id = Number(credential.slice(0, pipe));
    const secret = credential.slice(pipe + 1);

    if (!Number.isInteger(id) || id < 1 || !secret) return null;
    return { id, secret };
  }

  static #normalizeAbilities(abilities) {
    if (abilities === '*') return ['*'];
    if (typeof abilities === 'string') return [abilities];
    if (Array.isArray(abilities) && abilities.length) {
      return abilities.map(String);
    }
    return ['*'];
  }

  static #parseAbilities(raw) {
    if (Array.isArray(raw)) return raw;
    if (typeof raw !== 'string' || !raw) return ['*'];
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) && parsed.length ? parsed.map(String) : ['*'];
    } catch {
      return [raw];
    }
  }
}
