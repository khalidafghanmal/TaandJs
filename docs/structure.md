# Project structure

Taand uses a simple, familiar layout. All paths are defined in `engine/core/ProjectPaths.js`.

## Directory map

| Folder | Purpose |
|--------|---------|
| `engine/` | Framework engine (routing, HTTP, validation, CLI, …) |
| `start/` | Bootstrap facades (`app.js`, `route.js`, `cache.js`, …) |
| `settings/` | Configuration modules (env-driven) — see [config.md](./config.md) |
| `src/` | Your application code |
| `ui/` | TaandView templates (`.taand`) |
| `flow/` | Route definitions (`http.js`) |
| `web/` | Public assets (CSS, JS, images) |
| `records/seeds/` | Database seeders |
| `schema/` | Prisma schema & migrations |
| `storage/` | Runtime data (cache, logs, sessions, uploads, SQLite DB) |
| `bin/` | CLI entry (`taand.js`, `dev.js`, …) |
| `specs/` | Test suite |

## Application folder

```
src/
├── actions/        # HTTP controllers (HomeController.js)
├── features/       # Feature folders (optional — see docs/modules.md)
├── resources/      # API JSON resources (UserResource.js)
├── jobs/           # Queue jobs
├── listeners/      # Event listeners
├── mail/           # Mailable classes
├── events/         # Event classes (make:event)
├── middleware/     # Custom middleware classes
├── providers/      # Custom service providers
├── events.js       # Event → listener map
├── middleware.js   # Register custom middleware
├── policies.js     # Authorization policies
└── schedule.js     # Scheduled tasks (see docs/scheduler.md)
```

## Design rules

TaandJs uses short, product-owned names instead of mirroring another framework:

| Layer | Folder |
|-------|--------|
| Runtime engine | `engine/` |
| Public helper entrypoints | `start/` |
| HTTP flow | `flow/http.js` |
| Application actions | `src/actions/` |
| Feature folders | `src/features/` |
| UI templates | `ui/` |
| Static assets | `web/` |
| Runtime state | `storage/` |

## Key files

| File | Role |
|------|------|
| `start/app.js` | Application bootstrap & service providers |
| `flow/http.js` | Route table |
| `settings/runtime.js` | App name, env, debug, dev port |
| `settings/data.js` | `DATABASE_URL` (default: local PostgreSQL), Redis |
| `.env` | Environment overrides |

## CLI generators

| Command | Output |
|---------|--------|
| `Taand make:controller` | `src/actions/` |
| `Taand make:module` | `src/features/{Name}/` |
| `Taand make:job` | `src/jobs/` |
| `Taand make:listener` | `src/listeners/` |
| `Taand make:mail` | `src/mail/` |
| `Taand make:middleware` | `src/middleware/` |
| `Taand make:seeder` | `records/seeds/` |

Routes still use `'HomeController@index'` strings — only the **folder** changed, not class names or behavior.

## CLI architecture

| Layer | Path | Role |
|-------|------|------|
| Fast entry | `bin/taand.js` | `make:*` bypasses full CLI boot |
| Generator engine | `engine/cli/generator/` | Template-based file creation (no DB/routes) |
| CLI cache | `storage/cli-cache/` | Mtime-cached config & routes |
| Daemon (experimental) | `Taand daemon` | Preloads templates for near-instant `make:*` |

Generator commands use **lazy booting** — they never load `start/app.js`, connect to the database, or register routes. `route:list` and `config:show` use lite bootstrap + disk cache when possible.

Set `TAAND_CLI_NO_DAEMON=1` to force cold-start dispatch.
