# Production deployment

Checklist and architecture for running TaandJs in production — migrations, env validation, processes, and deploy flow.

---

## Quick deploy

```bash
# 1. Environment
cp .env.example .env
# Set: TAAND_ENV=production, TAAND_DEBUG=false, TAAND_APP_KEY, DATABASE_URL, DIRECT_URL

# 2. Dependencies & client
npm ci --omit=dev
npm run db:generate

# 3. Migrations (production — never use db:migrate here)
npm run db:migrate:prod

# 4. Build & start
npm run build
npm run start
```

Health check: `GET /up` → `{ "status": "ok", "uptime": … }`

---

## How it is structured

```
Deploy pipeline
     │
     ├─ npm ci
     ├─ prisma generate          (npm run db:generate)
     ├─ prisma migrate deploy    (npm run db:migrate:prod)  ← applies pending migrations only
     ├─ npm run build            → dist/ bundle
     └─ npm run start            → ProductionServer on :8000
              │
              ├─ assertProductionEnv()  ← TAAND_APP_KEY, DATABASE_URL
              ├─ HttpRequestHandler
              └─ GET /up health
```

### Dev vs production migrations

| Command | Script | When |
|---------|--------|------|
| `npm run db:migrate` | `prisma migrate dev` | **Local only** — creates new migration files, interactive |
| `npm run db:migrate:prod` | `prisma migrate deploy` | **Production/CI** — applies existing migrations, non-interactive |

**Never run `migrate dev` in production** — it can prompt for input and create new migration files.

---

## Environment validation

On `npm run start`, `ProductionServer` calls `assertProductionEnv()` (`engine/core/ProductionEnvValidator.js`):

| Check | Failure |
|-------|---------|
| `TAAND_APP_KEY` is set and not the example placeholder | Throws — server won't start |
| `DATABASE_URL` is set | Throws |
| `DATABASE_URL` still example value in production | Throws |
| Non-PostgreSQL URL | Warning only |

Also warns if `TAAND_DEBUG=true` with `TAAND_ENV=production`.

---

## Required environment variables

```env
TAAND_ENV=production
TAAND_DEBUG=false
TAAND_APP_KEY=your-random-32-plus-character-secret
DATABASE_URL=postgresql://user:pass@host:5432/db?sslmode=require
DIRECT_URL=postgresql://user:pass@direct-host:5432/db?sslmode=require
```

For **Neon**: pooled URL → `DATABASE_URL`, direct URL → `DIRECT_URL`.

---

## Process layout

Run at least two processes in production:

```bash
# Web
npm run start

# Queue worker (when QUEUE_CONNECTION=database)
npm run queue:work -- --connection=database
```

Use PM2, systemd, or Docker orchestration to keep both alive.

---

## Neon / managed Postgres flow

```
1. Create Neon project
2. Copy pooled connection string  → DATABASE_URL
3. Copy direct connection string  → DIRECT_URL
4. npm run db:migrate:prod        → creates tables on Neon
5. npm run build && npm run start
```

---

## CI alignment

GitHub Actions (`.github/workflows/ci.yml`) runs on Node.js 22 and 24:

1. `npm ci` + `npm run db:generate`
2. `npm test`
3. `npm run build` and check `dist/serve.js` exists

CI does not run migrations against a database; run `npm run db:migrate:prod` against a staging database before deploying.

---

## Docker (app container)

Infrastructure-only compose is in [docker.md](./docker.md). To containerize the app:

```dockerfile
FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .
RUN npm run db:generate && npm run build
CMD ["sh", "-c", "npm run db:migrate:prod && npm run start"]
```

Run migrations **before** accepting traffic (entrypoint or init container).

---

## Security checklist

- [ ] `TAAND_DEBUG=false`
- [ ] Strong `TAAND_APP_KEY`
- [ ] HTTPS via reverse proxy (nginx, Caddy, Cloudflare)
- [ ] `session.secure: true` in `config/auth.js` behind HTTPS
- [ ] Restrict `CORS_ALLOWED_ORIGINS` to your frontend domain
- [ ] `npm audit` regularly

See [SECURITY.md](../SECURITY.md).

---

## See also

- [server.md](./server.md) — ProductionServer details
- [database.md](./database.md) — Prisma & schema workflow
- [docker.md](./docker.md) — local Postgres/Redis
- [queue.md](./queue.md) — background workers
