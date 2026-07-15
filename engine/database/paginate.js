import { Paginator } from './Paginator.js';

const MAX_PER_PAGE = 100;
const DEFAULT_PER_PAGE = 15;

/**
 * Paginate a Prisma model delegate — e.g. paginate(db().user, { page: 1 }).
 *
 * @param {object} delegate — Prisma delegate (db().user, db().post, …)
 * @param {object} options — page, perPage, path, pageName, plus Prisma findMany args
 */
export async function paginate(delegate, options = {}) {
  if (!delegate?.findMany || !delegate?.count) {
    throw new TypeError('[Taand] paginate() expects a Prisma model delegate');
  }

  const {
    page = 1,
    perPage = DEFAULT_PER_PAGE,
    path = null,
    pageName = 'page',
    ...query
  } = options;

  const currentPage = Math.max(1, Number(page) || 1);
  const limit = Math.min(MAX_PER_PAGE, Math.max(1, Number(perPage) || DEFAULT_PER_PAGE));
  const skip = (currentPage - 1) * limit;
  const where = query.where;

  const [total, items] = await Promise.all([
    delegate.count(where ? { where } : undefined),
    delegate.findMany({ ...query, skip, take: limit }),
  ]);

  return new Paginator({
    items,
    total,
    page: currentPage,
    perPage: limit,
    path,
    pageName,
  });
}
