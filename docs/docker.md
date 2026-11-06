# Docker (local dev services)

Optional **Postgres + Redis** for local development — similar to [Taand Sail](https://taand.com/docs/sail), but lighter. The app still runs on your machine with `npm run dev`; Docker only provides the databases.

---

## Quick start

```bash
cd TaandJs
npm run docker:up          # start Postgres + Redis in background
cp .env.example .env       # DATABASE_URL already points at docker Postgres
npm install
npm run db:migrate
npm run dev
```

Stop services:

```bash
npm run docker:down
```

---

## How it is structured

```
TaandJs/
├── docker-compose.yml     ← service definitions (Postgres, Redis)
├── .env                   ← app connects via DATABASE_URL / REDIS_URL
├── package.json           ← npm run docker:up / docker:down
└── (your Node app runs outside Docker)
```

### Request flow (local dev)

```
npm run dev  →  Taand HTTP server (Node on :2977)
                      ↓
              DATABASE_URL → Postgres container (:5432)
              REDIS_URL    → Redis container (:6379)  [optional, future drivers]
```

Unlike a full app-in-Docker setup, **only infrastructure runs in containers**. Your code stays on the host for fast hot reload.

---

## `docker-compose.yml` breakdown

| Service | Image | Port | Purpose |
|---------|-------|------|---------|
| `postgres` | `postgres:16-alpine` | 5432 | Primary database (matches default `DATABASE_URL`) |
| `redis` | `redis:7-alpine` | 6379 | Cache / sessions / queues (when Redis drivers are enabled) |

Both services include **healthchecks** — `docker compose ps` shows `healthy` once they accept connections. Ports are bound to `127.0.0.1` only.

Data persists in a named volume `taand_pg_data` — stopping containers does not wipe your database.

---

## Environment variables

Default `.env.example` values match Docker Compose:

```env
DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:5432/taand?schema=public"
DIRECT_URL="postgresql://postgres:postgres@127.0.0.1:5432/taand?schema=public"
REDIS_URL=redis://127.0.0.1:6379
```

| Variable | When to change |
|----------|----------------|
| `DATABASE_URL` | Neon/production host, credentials, pooler URL |
| `DIRECT_URL` | Neon direct (non-pooler) host for migrations |
| `REDIS_URL` | Redis host. While set, sessions default to Redis (`SESSION_DRIVER`); cache and queue follow `TAAND_CACHE_STORE` / `QUEUE_CONNECTION` |

---

## CI (GitHub Actions)

CI uses the same pattern: a **Postgres service container** plus `DATABASE_URL`, then:

```bash
npm run db:migrate:prod   # production migration command — not migrate dev
npm test
```

This proves migrations apply cleanly on a fresh PostgreSQL instance.

---

## Production vs local Docker

| | Local (`docker-compose.yml`) | Production |
|---|------------------------------|------------|
| App | `npm run dev` on host | `npm run build && npm run start` |
| Database | Docker Postgres | Neon, RDS, managed Postgres |
| Redis | Docker Redis (optional) | ElastiCache, Upstash, etc. |
| Migrations | `npm run db:migrate` | `npm run db:migrate:prod` |

See [production.md](./production.md) for deploy checklist.

---

## Troubleshooting

### Port 5432 already in use

Another Postgres is running locally. Stop it or change the compose port mapping:

```yaml
ports:
  - '127.0.0.1:5433:5432'
```

Then update `DATABASE_URL` to use port `5433`.

### `connection refused` on migrate

Wait for Postgres healthcheck, or run `docker compose ps` and confirm `healthy`.

### Reset database volume

```bash
docker compose down -v
npm run docker:up
npm run db:migrate
```

---

## See also

- [database.md](./database.md) — Prisma schema & migrations
- [production.md](./production.md) — deploy & `db:migrate:prod`
- [server.md](./server.md) — production HTTP server
