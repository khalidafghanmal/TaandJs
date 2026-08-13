import { app } from './app.js';
import { paginate as paginateQuery } from '../engine/database/paginate.js';

/**
 * Paginate a Prisma model delegate.
 *
 *   const users = await paginate(db().user, { page: 1, perPage: 15 });
 */
export async function paginate(delegate, options = {}) {
  return paginateQuery(delegate, options);
}

export default paginate;
