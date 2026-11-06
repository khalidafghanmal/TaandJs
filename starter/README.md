# Starter template

This folder documents the **default project layout** created by `create-taand`.

When you run:

```bash
npm create taand@latest my-app
# or locally:
node bin/create.js my-app
```

the scaffolder copies the Taand project (excluding `node_modules`, `dist`, runtime `storage/` data, and `.env`) into `my-app/`.

## Flags

| Flag | Effect |
|------|--------|
| `--no-install` | Skip `npm install` and migrations |

## Included

- `engine/` — framework engine
- `start/`, `settings/`, `src/`, `flow/`, `ui/`, `web/`
- `schema/`, `records/seeds/`, `bin/`, `specs/`, `docs/`
- `package.json`, `.env.example`, `docker-compose.yml`

## Not copied

- `node_modules/`, `dist/`, `starter/`, `packages/`, `.git/`, `.github/`
- `.env` (copied from `.env.example` instead)
- Runtime data under `storage/` (logs, database, view/CLI/data caches, sessions, mail outbox)

## After create

```bash
cd my-app
npm run docker:up      # optional local Postgres
npm run dev            # if --no-install was not used
```

See [../docs/1.md](../docs/1.md) for the full open-source readiness checklist.
