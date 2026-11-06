# TaandJs Documentation

TaandJs is a JavaScript framework built for modern Node.js apps — built for **security**, **performance**, and **developer experience**.

## Quick start

```bash
cd TaandJs
cp .env.example .env
npm install
npm run db:migrate
npm run dev
```

Open `http://127.0.0.1:2977` (falls back to `1893` if busy).

**Production:** `npm run build && npm run start` → `http://127.0.0.1:8000` · See [server.md](./server.md).

**Open-source checklist:** [1.md](./1.md) — CI, legal files, tests, create flow.

## Documentation index

| Topic | File |
|-------|------|
| Core & bootstrap | [core.md](./core.md) |
| **Project structure** | [structure.md](./structure.md) |
| **Production server** | [server.md](./server.md) |
| Routing | [routing.md](./routing.md) |
| Controllers | [controllers.md](./controllers.md) |
| **Feature modules** | [modules.md](./modules.md) |
| Middleware (kernel, groups, CSRF) | [middleware.md](./middleware.md) |
| Authentication & authorization | [auth.md](./auth.md) |
| **Auth scaffolding (login/register)** — not available yet | [auth-scaffolding.md](./auth-scaffolding.md) |
| **CORS** | [cors.md](./cors.md) |
| **Production deployment** | [production.md](./production.md) |
| **Docker (local Postgres/Redis)** | [docker.md](./docker.md) |
| **Validation** | [validation.md](./validation.md) |
| **Pagination** | [pagination.md](./pagination.md) |
| **API Resources** | [api-resources.md](./api-resources.md) |
| **Seeders** | [seeders.md](./seeders.md) |
| **Testing** | [testing.md](./testing.md) |
| **Logging** | [logging.md](./logging.md) |
| **Events & listeners** | [events.md](./events.md) |
| **Cache** | [cache.md](./cache.md) |
| **Mail** | [mail.md](./mail.md) |
| **Queue & jobs** | [queue.md](./queue.md) |
| **Redis (multi-server)** | [redis.md](./redis.md) |
| **S3 / cloud storage** | [storage.md](./storage.md) |
| **Task scheduler (cron)** | [scheduler.md](./scheduler.md) |
| **Production features overview** | [production-features.md](./production-features.md) |
| Error pages (404, 403, 419, …) | [errors.md](./errors.md) |
| Assets & uploads (images, video, audio) | [assets.md](./assets.md) |
| Database (Prisma ORM) | [database.md](./database.md) |
| Configuration & env | [config.md](./config.md) |
| **Helpers** | [helpers.md](./helpers.md) |
| **Attempt limiter (brute-force)** | [attempt-limit.md](./attempt-limit.md) |
| TaandView templates | [views.md](./views.md) |
| Live reload (dev) | [hot-reload.md](./hot-reload.md) |

## Project structure

```
TaandJs/
├── engine/              # Framework engine
├── start/               # Boot facades (app, route, db…)
├── settings/            # Configuration
├── src/                 # Actions, features, jobs, mail, policies
├── ui/                  # .taand templates
├── flow/                # HTTP flow (http.js)
├── web/                 # Public assets
├── records/seeds/       # Prisma seeders
├── schema/              # Schema & migrations
├── storage/             # Runtime (cache, logs, uploads, DB)
├── bin/                 # CLI commands
├── specs/               # Test suite
└── docs/                # Documentation
```
