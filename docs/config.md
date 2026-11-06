# Configuration

TaandJs uses `.env` files plus the modules in `settings/`. Each settings file default-exports a plain object and reads environment values with `env()`.

## Environment variables

Copy the example file:

```bash
cp .env.example .env
```

| Variable | Default | Description |
|----------|---------|-------------|
| `TAAND_NAME` | TaandJs | Application name |
| `TAAND_ENV` | local | Environment |
| `TAAND_DEBUG` | true | Show detailed errors |
| `TAAND_PORT` | 2977 | Dev server port |
| `TAAND_FALLBACK_PORT` | 1893 | Fallback port |
| `TAAND_VIEW_CACHE` | true | Cache compiled views |
| `TAAND_HOT_RELOAD` | true | Live reload in local dev |
| `CORS_ENABLED` | true | CORS middleware (see [cors.md](./cors.md)) |
| `CORS_ALLOWED_ORIGINS` | `*` | Comma-separated allowed origins |
| `DATABASE_URL` | — | PostgreSQL connection (see [database.md](./database.md)) |
| `DIRECT_URL` | — | Direct DB URL for migrations (Neon pooler setups) |

`.env.example` lists every variable, grouped by area.

Existing OS environment variables are **never overwritten**.

## Settings files

The loader (`engine/core/SettingsLoader.js`) imports these modules and maps them onto the registry keys the engine reads with `config.get()`:

| File | Key in file | Registry key | Covers |
|------|-------------|--------------|--------|
| `settings/runtime.js` | *(whole file)* | `app` | Name, env, debug, dev ports, app key, hot reload, `modules` |
| `settings/server.js` | *(whole file)* | `server` | Production host/port, timeouts, health path |
| `settings/ui.js` | *(whole file)* | `view` | View cache |
| `settings/http.js` | `global` | `middleware.global` | Global middleware stack |
| | `stacks.browser` / `stacks.json` | `middleware.groups.web` / `.api` | Route group stacks |
| | `filters.signedIn` / `filters.signedOut` | `middleware.aliases.auth` / `.guest` | Auth middleware aliases |
| | `priority` | `middleware.priority` | Middleware ordering |
| | `crossOrigin` | `cors` | CORS paths, origins, headers |
| `settings/security.js` | `defaultMode` | `auth.default` | `'browser'` → session guard |
| | `browser.session` | `auth.session` | Session driver, lifetime, cookie, `secure`, `sameSite` |
| | `browser.remember` | `auth.remember` | Remember-me cookie |
| | `browser.pages` | `auth.routes` | Login / register / home paths |
| | `token` | `auth.tokens` | API token prefix, expiry, machine abilities |
| | `accounts` | `auth.providers` | User provider (Prisma model) |
| | `hashing.scrypt` | `auth.passwords.scrypt` | Password hashing cost |
| | `roles` | `auth.roles` | Role hierarchy and permissions |
| `settings/data.js` | `primary` | `database` | `DATABASE_URL`, connection |
| | `redis` | `redis` | Redis connections and prefixes |
| `settings/platform.js` | `memory` | `cache` | Cache stores |
| | `jobs` | `queue` | Queue connections |
| | `notify` | `mail` | Mailers, from address |
| | `observability` | `logging` | Log channels, level, redaction |
| | `dispatch` | `events` | Event dispatcher limits |
| | `volumes` | `filesystems` | Storage disks (local, S3) |
| | `static` | `assets` | Asset URL, upload limits, MIME allow-list |
| `settings/errors.js` | *(whole file)* | `errors` | Error page copy |
| `settings/validation.js` | *(whole file)* | `validation` | Validation messages and attribute names |

Keys not listed under `settings/security.js`, `settings/http.js` or `settings/data.js` are **not** passed through. Put custom app values in `settings/runtime.js` and read them as `app.<key>`.

Read values with the **registry key** in providers and controllers:

```js
const debug = this.app.make('config').get('app.debug');
const cache = this.app.make('config').get('view.cache');
const sessionLifetime = this.app.make('config').get('auth.session.lifetime');
```

The CLI shows the raw settings files, keyed by **file name**:

```bash
node bin/taand.js config:show runtime.env
node bin/taand.js config:show data.primary
```

> Legacy layout: if `settings/runtime.js` is missing and the project still has an old `config` folder with an `app.js`, the loader reads that folder instead, one module per registry key (`app.js`, `view.js`, `middleware.js`, `cors.js`, `auth.js`, …). New projects use `settings/`.

## Security

- Never commit `.env` to version control
- Set `TAAND_DEBUG=false` in production
- Use environment variables for secrets (never hardcode)
