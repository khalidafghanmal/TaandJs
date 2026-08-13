import { app } from './app.js';

/**
 * Database facade — Prisma client.
 *
 *   const users = await db().user.findMany();
 */
export function db() {
  return app.make('db');
}

export default db;
