import path from 'node:path';
import { PrismaClient } from '@prisma/client';

/**
 * Prisma lifecycle — singleton client, safe for Taand dev hot-reload.
 */
export class PrismaManager {
  constructor(app) {
    this.app = app;
    this.#client = null;
  }

  #client;

  client() {
    if (!this.#client) {
      const debug = this.app.make('config').get('app.debug', false);

      this.#client = new PrismaClient({
        datasources: {
          db: { url: PrismaManager.#resolveDatabaseUrl(this.app) },
        },
        log: debug ? ['warn', 'error'] : ['error'],
      });
    }
    return this.#client;
  }

  static #resolveDatabaseUrl(app) {
    const url = app.make('config').get('database.url', 'file:../storage/database/taand.db');
    if (!url.startsWith('file:')) return url;

    const filePath = url.slice(5);
    if (path.isAbsolute(filePath)) return url;

    return `file:${path.resolve(app.basePath, 'prisma', filePath)}`;
  }

  async connect() {
    await this.client().$connect();
  }

  async disconnect() {
    if (this.#client) {
      await this.#client.$disconnect();
      this.#client = null;
    }
  }
}
