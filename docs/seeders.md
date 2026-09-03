# Database Seeders

Fill your database with **test or default data** using Prisma — Taand's seeder equivalent. Seeders live in `records/seeds/` and run through the CLI.

## Why seeders?

- **Local development** — admin user, sample products, demo posts
- **Staging** — realistic data for QA
- **CI tests** — predictable starting state

Seeders use `db()` (Prisma Client) directly — no separate model layer.

---

## Quick start

```bash
npm run db:migrate   # tables first
npm run db:seed      # run DatabaseSeeder
```

Creates `admin@example.com` / `password` if not present (see `UserSeeder`).

---

## Project structure

```
records/seeds/
├── DatabaseSeeder.js   # Entry point — calls other seeders
└── UserSeeder.js       # Example: admin user
```

---

## Writing a seeder

```js
// records/seeds/UserSeeder.js
import { Seeder } from '../../engine/database/Seeder.js';

export class UserSeeder extends Seeder {
  async run() {
    const email = 'admin@example.com';
    const exists = await this.db().user.findUnique({ where: { email } });
    if (exists) return;

    const password = await this.hasher().hash('password');

    await this.db().user.create({
      data: { name: 'Admin', email, password, role: 'admin' },
    });
  }
}
```

### Base `Seeder` helpers

| Method | Description |
|--------|-------------|
| `this.db()` | Prisma client (`db()`) |
| `this.hasher()` | Scrypt password hasher |
| `await this.call(OtherSeeder)` | Run another seeder class |

---

## DatabaseSeeder

Orchestrates all seeders:

```js
import { Seeder } from '../../engine/database/Seeder.js';
import { UserSeeder } from './UserSeeder.js';
import { ProductSeeder } from './ProductSeeder.js';

export class DatabaseSeeder extends Seeder {
  async run() {
    await this.call(UserSeeder);
    await this.call(ProductSeeder);
  }
}
```

---

## Commands

| Command | Action |
|---------|--------|
| `npm run db:seed` | Run `DatabaseSeeder` |
| `Taand db:seed` | Same |
| `Taand db:seed --class=UserSeeder` | Run one seeder only |
| `Taand make:seeder ProductSeeder` | Create new seeder file |

---

## Idempotent seeders

Always check before insert — seeders may run many times:

```js
const row = await this.db().user.findUnique({ where: { email } });
if (row) return;
```

Or use Prisma `upsert`:

```js
await this.db().user.upsert({
  where: { email: 'admin@example.com' },
  update: {},
  create: { name: 'Admin', email: 'admin@example.com', password, role: 'admin' },
});
```

---

## Security

| Practice | Detail |
|----------|--------|
| Hash passwords | Use `this.hasher().hash()` — never plain text |
| No production secrets | Do not hardcode real credentials |
| Guard admin seeders | Only seed privileged users in dev/staging |
| `.env` | Use env vars for seeded admin email in staging |

---

## Workflow

```bash
# 1. Edit schema/schema.prisma
# 2. Migrate
npm run db:migrate -- --name add_products

# 3. Create seeder
Taand make:seeder ProductSeeder

# 4. Register in DatabaseSeeder
# 5. Seed
npm run db:seed
```

---

## See also

- [Database (Prisma)](./database.md)
- [Authentication](./auth.md) — roles for seeded admin
- [Validation](./validation.md) — `unique` rule when creating via forms
