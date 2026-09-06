# API Resources

Shape Prisma models into **safe, consistent JSON** — Taand's `JsonResource` equivalent. Hide passwords, rename fields, and wrap collections without a second ORM.

## Why API resources?

Raw Prisma rows may include `password`, internal IDs, or nested relations you do not want in public APIs. Resources transform each row through a single `toArray()` method.

```
Prisma row → UserResource.toArray() → { id, name, email, role }
```

Works with:

- Single records
- Arrays / collections
- [Paginated](./pagination.md) results

---

## Quick start

### 1. Create a resource

```js
// src/resources/UserResource.js
import { JsonResource } from '../../engine/http/JsonResource.js';

export class UserResource extends JsonResource {
  toArray() {
    const u = this.resource;
    return {
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
    };
  }
}
```

### 2. Return from a controller

```js
import { UserResource } from '../Resources/UserResource.js';

// Single user
show(req) {
  const user = await this.db().user.findUnique({ where: { id: Number(req.params.id) } });
  return UserResource.make(user);
}

// Collection
index(req) {
  const users = await this.db().user.findMany();
  return UserResource.collection(users);
}

// Paginated
async list(req) {
  const page = await this.paginate(this.db().user, {
    page: req.input('page', 1),
    path: req.path,
  });
  return UserResource.paginate(page);
}
```

---

## Response shapes

### Single record (`make`)

```json
{
  "data": {
    "id": 1,
    "name": "Admin",
    "email": "admin@example.com",
    "role": "admin"
  }
}
```

### Collection (`collection`)

```json
{
  "data": [
    { "id": 1, "name": "Admin", "email": "admin@example.com" },
    { "id": 2, "name": "Jane", "email": "jane@example.com" }
  ]
}
```

### Paginated (`paginate`)

Keeps [pagination meta & links](./pagination.md), transforms only `data`:

```json
{
  "data": [ { "id": 1, "name": "Admin" } ],
  "meta": { "current_page": 1, "total": 10, "per_page": 15, "last_page": 1 },
  "links": { "first": "/users?page=1", "last": "/users?page=1", "prev": null, "next": null }
}
```

---

## API reference

### `JsonResource`

| Method | Purpose |
|--------|---------|
| `toArray()` | Override — return plain object for one row |
| `JsonResource.make(row)` | Wrap one model |
| `JsonResource.collection(rows)` | Wrap an array |
| `JsonResource.paginate(paginator)` | Wrap paginator items |

### Disable `{ data: … }` wrapper

```js
export class PlainResource extends JsonResource {
  static wrap = false;

  toArray() {
    return { ok: true };
  }
}
```

Returns `{ ok: true }` instead of `{ data: { ok: true } }`.

---

## Conditional fields

```js
toArray() {
  const u = this.resource;
  const out = { id: u.id, name: u.name };

  if (u.role === 'admin') {
    out.email = u.email;
  }

  return out;
}
```

For auth-aware resources, pass the current user via constructor data or read from a closure in the controller.

---

## Security checklist

| Rule | Why |
|------|-----|
| Never expose `password` | Even hashed values should not leak |
| Use `select` in Prisma | Fetch only columns you need |
| Always use resources on `/api/*` | One place to audit public fields |
| Validate input separately | Resources output only — see [validation.md](./validation.md) |

---

## Prisma-first design

Resources do **not** replace Prisma. Typical flow:

1. **Query** with `db().user.findMany({ select: { … } })`
2. **Paginate** with `paginate(db().user, { … })`
3. **Shape** with `UserResource.paginate(page)`

No Eloquent-style model class required.

---

## See also

- [Pagination](./pagination.md)
- [Validation](./validation.md) — `unique` / `exists` rules
- [Controllers](./controllers.md)
