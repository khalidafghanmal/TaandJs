# CORS (Cross-Origin Resource Sharing)

CORS lets **browser-based clients** (React, Vue, mobile WebView) call your API from a **different origin** (e.g. `http://localhost:3000` → `http://localhost:2977`).

Without CORS headers, the browser blocks the response even if your server handled the request correctly.

---

## Quick start

CORS is **enabled by default** for paths matching `api/*`.

```js
// flow/http.js
import route from '../start/route.js';

route.group({ prefix: '/api', middleware: ['api'] }, () => {
  route.get('/users', 'UserController@index');
});
```

A SPA at `http://localhost:3000` can now call `GET http://localhost:2977/api/users`.

Configure origins in `.env`:

```env
CORS_ALLOWED_ORIGINS=http://localhost:3000,https://app.example.com
CORS_SUPPORTS_CREDENTIALS=true
```

---

## How it is structured

```
Browser (origin A)                    Taand server (origin B)
       │                                      │
       │  OPTIONS /api/users  (preflight)     │
       │ ───────────────────────────────────► │  HandleCors → 204 + Allow-* headers
       │                                      │
       │  GET /api/users + Origin header      │
       │ ───────────────────────────────────► │  api middleware → Controller
       │ ◄─────────────────────────────────── │  HandleCors.terminate → Allow-Origin
```

### Files involved

| Piece | Location | Role |
|-------|----------|------|
| Config | `settings/http.js` → `crossOrigin` | Paths, origins, methods, headers |
| Middleware | `engine/middleware/global/HandleCors.js` | Preflight + response headers |
| Registration | `engine/providers/MiddlewareServiceProvider.js` | Registers `cors` alias |
| Kernel stack | `settings/http.js` → `global` | `cors` in **global** middleware (early) |

### Middleware lifecycle

1. **Global stack runs first** — `cors` sits after `trustProxies`, before route handlers.
2. **Path match** — only paths in `settings/http.js` → `crossOrigin.paths` (default `api/*`) get CORS.
3. **OPTIONS preflight** — answered immediately with `204` and `Access-Control-*` headers; controller never runs.
4. **Normal requests** — handler runs; `terminate()` adds CORS headers to the final response.

This mirrors Taand's `HandleCors` middleware + `config/cors.php`.

---

## Configuration

`settings/http.js` → `crossOrigin` (registry key `cors`):

```js
crossOrigin: {
  enabled: true,
  paths: ['api/*'],
  allowedOrigins: ['*'],           // or specific origins from CORS_ALLOWED_ORIGINS
  allowedMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'X-CSRF-TOKEN'],
  exposedHeaders: [],
  maxAge: 0,
  supportsCredentials: false,
},
```

### Environment variables

| Variable | Default | Description |
|----------|---------|-------------|
| `CORS_ENABLED` | `true` | Set `false` to disable entirely |
| `CORS_ALLOWED_ORIGINS` | `*` | Comma-separated origins |
| `CORS_SUPPORTS_CREDENTIALS` | `false` | Send cookies cross-origin (requires specific origin, not `*`) |
| `CORS_MAX_AGE` | `0` | Preflight cache seconds in browser |

---

## Path patterns

| Pattern | Matches |
|---------|---------|
| `api/*` | `/api`, `/api/users`, `/api/v1/posts` |
| `*` | Every path |
| `webhooks/stripe` | Exact path only |

Add patterns in `settings/http.js` → `crossOrigin.paths`.

---

## SPA + session auth

If your API uses **cookies** (session guard) from a SPA:

```env
CORS_ALLOWED_ORIGINS=http://localhost:3000
CORS_SUPPORTS_CREDENTIALS=true
```

And ensure `settings/security.js` → `browser.session.secure` / `sameSite` match your setup.

For **Bearer token** API auth, credentials are usually not needed.

---

## Disable CORS on a route

CORS is global for matching paths. To exclude a path, remove it from `paths` or set `CORS_ENABLED=false` and attach custom logic in `src/middleware.js`.

---

## Taand comparison

| Taand | Taand |
|---------|-------|
| `config/cors.php` | `settings/http.js` → `crossOrigin` |
| `\Illuminate\Http\Middleware\HandleCors` | `engine/middleware/global/HandleCors.js` |
| `paths` => `['api/*']` | Same pattern |
| `supports_credentials` | `supportsCredentials` |

---

## See also

- [middleware.md](./middleware.md) — kernel stack & groups
- [auth.md](./auth.md) — session vs API token guards
- [routing.md](./routing.md) — API route groups
