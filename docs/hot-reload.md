# Live Reload

TaandJs includes built-in live reload for local development — no extra tools required.

## How it works

1. File watcher monitors `ui`, `flow`, `settings`, and `src/actions`
2. On save, caches are cleared and routes/settings are hot-reloaded
3. Browser receives an SSE event and refreshes automatically

## Security

| Rule | Detail |
|------|--------|
| Local only | Enabled when `TAAND_ENV=local` |
| Bind address | Server runs on `127.0.0.1` only |
| Path scope | Watcher ignores paths outside project root |
| Ignored dirs | `node_modules`, `.git`, `storage` |
| Production | Live reload is **off** in production — SSE returns 404 |

## Disable

```env
TAAND_HOT_RELOAD=false
```

Or set `TAAND_ENV=production`.

## What reloads

| Change | Action |
|--------|--------|
| `.taand` files | View cache flushed |
| `flow/*.js` | Routes re-registered |
| `settings/*.js` | Settings reloaded |
| `src/actions/*.js` | Controller cache flushed |

## Console output

```
  ↻  ui updated — ui/main.taand
  ↻  flow updated — flow/http.js
```
