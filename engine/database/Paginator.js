/**
 * Length-aware paginator — taand-style meta for Prisma results.
 */
export class Paginator {
  constructor({ items, total, page, perPage, path = null, pageName = 'page' }) {
    this.items = items;
    this.total = total;
    this.page = page;
    this.perPage = perPage;
    this.path = path;
    this.pageName = pageName;
  }

  lastPage() {
    return Math.max(1, Math.ceil(this.total / this.perPage));
  }

  hasMorePages() {
    return this.page < this.lastPage();
  }

  isEmpty() {
    return this.total === 0;
  }

  toJSON() {
    const from = this.isEmpty() ? null : (this.page - 1) * this.perPage + 1;
    const to = this.isEmpty() ? null : Math.min(this.page * this.perPage, this.total);

    return {
      data: this.items,
      meta: {
        current_page: this.page,
        per_page: this.perPage,
        total: this.total,
        last_page: this.lastPage(),
        from,
        to,
      },
      links: this.#links(),
    };
  }

  #links() {
    if (!this.path) return {};

    const page = (n) => `${this.path}?${this.pageName}=${n}`;

    return {
      first: page(1),
      last: page(this.lastPage()),
      prev: this.page > 1 ? page(this.page - 1) : null,
      next: this.hasMorePages() ? page(this.page + 1) : null,
    };
  }
}
