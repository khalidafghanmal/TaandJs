# Pagination

Paginate Prisma query results with taand-style **meta** and **links** — built on `db()`, no extra ORM layer.

## Why pagination?

Listing hundreds of users or orders in one response is slow and unsafe. Pagination splits results into pages and returns metadata so clients can build “next / previous” UI.

Taand pagination:

- Works directly with **Prisma delegates** (`db().user`, `db().post`, …)
- Returns `data`, `meta`, and `links` JSON
- Pairs with [API Resources](./api-resources.md) to hide sensitive fields

---

## Quick start

```js
import paginate from '../start/paginate.js';
import { UserResource } from '../src/resources/UserResource.js';

export class UserController extends Controller {
  async index(req) {
    const page = await paginate(this.db().user, {
      page: req.input('page', 1),
      perPage: 15,
      path: req.path,
      orderBy: { createdAt: 'desc' },
      select: { id: true, name: true, email: true, role: true, createdAt: true },
    });

    return UserResource.paginate(page);
  }
}
```

**Response:**

```json
{
  "data": [
    { "id": 1, "name": "Admin", "email": "admin@example.com", "role": "admin" }
  ],
  "meta": {
    "current_page": 1,
    "per_page": 15,
    "total": 42,
    "last_page": 3,
    "from": 1,
    "to": 15
  },
  "links": {
    "first": "/users?page=1",
    "last": "/users?page=3",
    "prev": null,
    "next": "/users?page=2"
  }
}
```

---

## `paginate()` helper

```js
import paginate from '../start/paginate.js';
// or: await this.paginate(...) in controllers
```

### Signature

```js
await paginate(prismaDelegate, options)
```

| Option | Default | Description |
|--------|---------|-------------|
| `page` | `1` | Current page (min 1) |
| `perPage` | `15` | Items per page (max 100) |
| `path` | `null` | Base path for `links` (e.g. `req.path`) |
| `pageName` | `page` | Query param name for page links |
| `where`, `orderBy`, `select`, … | — | Any Prisma `findMany` argument |

### Examples

**Filter + sort:**

```js
await paginate(this.db().user, {
  page: req.input('page', 1),
  perPage: 20,
  where: { role: 'admin' },
  orderBy: { name: 'asc' },
});
```

**With relations (Prisma `include`):**

```js
await paginate(this.db().post, {
  page: 1,
  include: { author: { select: { id: true, name: true } } },
});
```

**Raw paginator (no API resource):**

```js
const page = await paginate(this.db().user, { page: 1 });
return page; // framework returns JSON automatically
```

---

## Controller helper

```js
const page = await this.paginate(this.db().user, {
  page: req.input('page', 1),
  path: req.path,
});
```

Same as `paginate()` — registered on the base `Controller`.

---

## Paginator class

When you need metadata in code before returning:

```js
import { Paginator } from '../engine/database/Paginator.js';

console.log(page.total);
console.log(page.lastPage());
console.log(page.hasMorePages());
console.log(page.toJSON());
```

---

## Security

| Practice | Detail |
|----------|--------|
| Max `perPage` | Capped at **100** — prevents abuse |
| `select` | Omit `password` and internal columns |
| Auth | Protect list routes with `auth` middleware |
| API resources | Use [UserResource](./api-resources.md) — never return raw Prisma rows |

---

## Prisma vs Taand

| Taand | Taand + Prisma |
|---------|----------------|
| `User::paginate(15)` | `paginate(db().user, { perPage: 15 })` |
| `$users->links()` | `links` in JSON response |
| Eloquent scopes | Prisma `where` in options |

No Eloquent-style `Model` class — pagination sits **on top of Prisma**.

---

## See also

- [API Resources](./api-resources.md) — shape paginated JSON
- [Database](./database.md) — Prisma setup
- [Controllers](./controllers.md) — `this.paginate()`
