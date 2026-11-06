# Database (Prisma)

TaandJs ships with **Prisma ORM** pre-installed — fullstack out of the box. **SQLite** is the default (no database server needed); switch to PostgreSQL or MySQL for production.

## What's included

| Piece | Location |
|-------|----------|
| Prisma schema | `schema/schema.prisma` |
| App config | `config/database.js` |
| Prisma Client | `@prisma/client` (generated on install) |
| Client singleton | `app.make('db')` or `db()` |
| Migrations | `schema/migrations/` |

Default schema includes a **`User`** model (auth, roles, admin). Add your own models in `schema/schema.prisma`.

---

## First-time setup

```bash
cd Taand
cp .env.example .env
npm install            # runs prisma generate via postinstall
npm run db:migrate     # creates storage/database/taand.db (local dev)
npm run dev
```

---

## Environment

The committed schema (`provider = "sqlite"`) and migrations target SQLite. Defaults from `.env.example`:

```env
DB_CONNECTION=sqlite
DATABASE_URL="file:../storage/database/taand.db"
DIRECT_URL="file:../storage/database/taand.db"
```

`file:` paths are resolved relative to `schema/`, so the database lives in `storage/database/`.

### Switching to PostgreSQL

1. Set `provider = "postgresql"` in `schema/schema.prisma`
2. Set the Postgres URLs in `.env`:
   ```env
   DB_CONNECTION=postgresql
   DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:5432/taand?schema=public"
   DIRECT_URL="postgresql://postgres:postgres@127.0.0.1:5432/taand?schema=public"
   ```
3. Create the database (`createdb taand` on macOS/Linux, or via pgAdmin on Windows)
4. The committed migrations are SQLite SQL and the lock file pins `sqlite`, so remove `schema/migrations/` and run `npm run db:migrate` to generate PostgreSQL migrations

### Neon / pooled PostgreSQL

Use the **pooled** connection string for `DATABASE_URL` and the **direct** (non-`-pooler`) string for `DIRECT_URL` when running migrations.

---

## Using the database

### `db()` helper

```js
import db from '../start/db.js';

const users = await db().user.findMany();
const user = await db().user.findUnique({ where: { email: 'you@example.com' } });
```

### In controllers

```js
export class UserController extends Controller {
  async index() {
    const users = await this.db().user.findMany({
      select: { id: true, name: true, email: true, role: true },
    });

    return { users };
  }

  async store(req) {
    const user = await this.db().user.create({
      data: {
        name: req.input('name'),
        email: req.input('email'),
        password: hashedPassword,
        role: 'user',
      },
    });

    return { id: user.id };
  }
}
```

### Container

```js
const db = app.make('db');
await db.user.count();
```

---

## NPM scripts

| Command | Action |
|---------|--------|
| `npm run db:migrate` | Create & apply migrations (**local dev only**) |
| `npm run db:migrate:prod` | Apply pending migrations (**production/CI**) — `prisma migrate deploy` |
| `npm run db:generate` | Regenerate Prisma Client after schema change |
| `npm run db:push` | Push schema without migration (prototyping) |
| `npm run db:studio` | Open Prisma Studio (visual DB browser) |
| `npm run docker:up` | Start local Postgres + Redis (see [docker.md](./docker.md)) |

`postinstall` runs `prisma generate` automatically after `npm install`.

---

## Schema workflow

1. Edit `schema/schema.prisma`
2. Run `npm run db:migrate -- --name describe_change`
3. Use `db().yourModel` in controllers

Example — add a `Post` model:

```prisma
model Post {
  id        Int      @id @default(autoincrement())
  title     String
  content   String?
  authorId  Int
  author    User     @relation(fields: [authorId], references: [id], onDelete: Cascade)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model User {
  // ...existing fields...
  posts Post[]
}
```

Then: `npm run db:migrate -- --name add_posts`

---

## Default User model

```prisma
model User {
  id        Int      @id @default(autoincrement())
  name      String
  email     String   @unique
  password  String
  role      String   @default("user")
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

Designed for session/API auth and `role:admin` middleware. Hash passwords before storing (bcrypt/scrypt) — never save plain text.

---

## Security

| Practice | Detail |
|----------|--------|
| Parameterized queries | Prisma Client — no raw SQL injection by default |
| Password field | Store hashed only — never log or return in API |
| Select fields | Use `select` to omit `password` from responses |
| DB file | `storage/database/` gitignored (SQLite only) |
| Connection | Single singleton — no connection leaks |
| Shutdown | Prisma disconnects on `Ctrl+C` |

---

## Performance

| Feature | Benefit |
|---------|---------|
| Singleton client | One connection pool per process |
| Compiled queries | Prisma query engine |
| Lazy connect | Connects on app bootstrap |
| SQLite default, PostgreSQL ready | Zero-setup local dev; switch provider for production |

For production at scale, use PostgreSQL and connection pooling (PgBouncer or Prisma Accelerate).

---

## Taand comparison

| Taand | Taand |
|---------|-------|
| `config/database.php` | `config/database.js` |
| Eloquent `User::all()` | `db().user.findMany()` |
| `npm run db:migrate` | `npm run db:migrate` |
| `DB::table()` | `db().$queryRaw` or models |
| `.env` `DB_*` | `.env` `DATABASE_URL` |
| `User::paginate(15)` | [paginate()](./pagination.md) |
| `npm run db:seed` | [npm run db:seed](./seeders.md) |
| Eloquent API Resources | [JsonResource](./api-resources.md) |
| `unique` / `exists` rules | [validation.md](./validation.md) |

---

## Related topics

| Topic | Doc |
|-------|-----|
| Paginate Prisma results | [pagination.md](./pagination.md) |
| Shape API JSON | [api-resources.md](./api-resources.md) |
| Seed demo data | [seeders.md](./seeders.md) |
| DB validation rules | [validation.md](./validation.md) |

---

## Troubleshooting

### `PrismaClient is unable to run`

Run `npm run db:generate` then `npm run db:migrate`.

### Database file missing

```bash
npm run db:migrate
```

### Schema changed

```bash
npm run db:migrate -- --name your_change
```

See also [middleware.md](./middleware.md) for `role:admin` and [controllers.md](./controllers.md).
