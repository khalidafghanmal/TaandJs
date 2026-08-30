# Configuration

TaandJs uses `.env` files and `config/` modules — like Taand.

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

Existing OS environment variables are **never overwritten**.

## Config files

| File | Purpose |
|------|---------|
| `config/app.js` | App name, debug, ports |
| `config/view.js` | View cache settings |

Access config in providers:

```js
const debug = this.app.make('config').get('app.debug');
const cache = this.app.make('config').get('view.cache');
```

## Security

- Never commit `.env` to version control
- Set `TAAND_DEBUG=false` in production
- Use environment variables for secrets (never hardcode)
