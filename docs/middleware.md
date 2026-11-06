# Middleware

TaandJs middleware mirrors Taand's HTTP kernel — global stack, route groups (`web`, `api`), aliases, **parameterized middleware** (`role:admin`), priority sorting, `withoutMiddleware`, class-based middleware, and terminable hooks.

## Request flow

```
Global middleware → Router → Route middleware → Handler → Terminable hooks
```

---

## Configuration

Define your kernel in `config/middleware.js`:

```js
export default {
  global: [
    'trustProxies',
    'cors',
    'validateSize',
    'trim',
    'log',
    'security',
  ],

  groups: {
    web: ['csrf'],
    api: ['json', 'throttle:120,1'],
  },

  aliases: {
    auth: 'authenticate',
    guest: 'guestOnly',
  },

  priority: [
    'trustProxies',
    'validateSize',
    'trim',
    'security',
    'throttle',
    'lockout',
    'authenticate',
    'role',
    'csrf',
    'json',
    'log',
  ],
};
```

| Key | Purpose |
|-----|---------|
| `global` | Runs on **every** request |
| `groups` | Named stacks — `middleware: 'web'` or `middleware: 'api'` |
| `aliases` | Short names — `auth` → `authenticate` |
| `priority` | Forces execution order when stacks merge |

---

## Built-in middleware

| Name | Usage | What it does |
|------|-------|--------------|
| `trustProxies` | Global | Real client IP from `X-Forwarded-For` |
| `validateSize` | Global | Rejects bodies over `server.maxBodySize` (413) |
| `trim` | Global | Trims all string input |
| `log` | Global | Logs method, path, status, duration |
| `security` | Global | CSP, COOP, Permissions-Policy headers |
| `cors` | Global | CORS preflight + `Access-Control-*` for API paths |
| `csrf` | `web` group | CSRF protection on mutating requests |
| `json` | `api` group | Requires `Accept: application/json` |
| `throttle` | `throttle:60,1` | Rate limit — 60 requests per minute (IP + path) |
| `lockout` | `lockout:5,1` | Credential brute-force — 5 failed logins per minute (email + IP) |
| `auth` | Route | Bearer token / `X-Api-Key` (`authenticate`) |
| `guest` | Route | Blocks authenticated users (`guestOnly`) |
| `role` | `role:admin` | Role gate — see below |

---

## Role-based access (taand-style)

Taand ships `RoleMiddleware` — the same idea as Taand's `RoleMiddleware` with a `$role` parameter.

### Taand

```php
// src/Http/Middleware/RoleMiddleware.php
public function handle(Request $request, Closure $next, $role)
{
    if (!auth()->check()) {
        return redirect('/login');
    }
    if (auth()->user()->role !== $role) {
        abort(403, 'Unauthorized');
    }
    return $next($request);
}

// flow/http.js
Route::get('/admin', [AdminController::class, 'index'])->middleware(['auth', 'role:admin']);
```

### Taand

```js
// flow/http.js
route.get('/admin', 'AdminController@index')
  .middleware(['auth', 'role:admin']);

route.get('/editor', 'EditorController@index')
  .middleware(['auth', 'role:editor']);

route.get('/dashboard', 'DashboardController@index')
  .middleware(['auth', 'role:user']);
```

`define which user does what` directly on the route — `role:admin`, `role:editor`, `role:user`.

### How it works

1. Your **auth middleware** sets the user on the request:
   ```js
   request.setAttribute('_user', { id: 1, name: 'Khalid', role: 'admin' });
   ```
2. **`role:admin`** checks `request.attribute('_user').role === 'admin'`.
3. Wrong role → **403 Forbidden**. Not logged in → **401 Unauthorized**.

### Read the user in a controller

```js
// src/actions/AdminController.js
export class AdminController extends Controller {
  index(req) {
    const user = req.attribute('_user');
    return this.view('admin.dashboard', { user });
  }
}
```

---

## Authentication & authorization

Session auth, roles, gates, and policies are **built into Taand**. Wire your own routes and controllers as needed.

Full guide: **[auth.md](./auth.md)**

---

## API authentication

For JSON APIs, use the built-in `auth` middleware with a Bearer token.

```env
# .env
TAAND_API_TOKEN=your-secret-token
```

```js
route.group({ prefix: '/api', middleware: ['api', 'auth'] }, () => {
  route.get('/me', (req) => {
    const user = req.attribute('_user');
    return { guard: user.guard };
  });
});
```

```bash
curl -H "Authorization: Bearer your-secret-token" http://127.0.0.1:2977/api/me
```

To combine API tokens with roles, set `role` on `_user` in custom middleware after `auth`:

```js
// src/Middleware/AssignApiRole.js
export class AssignApiRole extends Middleware {
  async handle(request, next) {
    const user = request.attribute('_user');
    if (user?.token === process.env.TAAND_ADMIN_TOKEN) {
      request.setAttribute('_user', { ...user, role: 'admin' });
    }
    return next(request);
  }
}
```

```js
route.get('/api/admin/stats', 'StatsController@index')
  .middleware(['api', 'auth', 'assignApiRole', 'role:admin']);
```

---

## Route middleware patterns

### Groups

```js
route.group({ middleware: ['web'] }, () => {
  route.get('/contact', 'ContactController@show');
  route.post('/contact', 'ContactController@store');
});

route.group({ prefix: '/api', middleware: ['api', 'auth'] }, () => {
  route.get('/status', () => ({ ok: true }));
});
```

### Single route

```js
route.post('/settings', 'SettingsController@update').middleware('auth');
```

### Skip middleware

```js
route.group({ middleware: ['web'], withoutMiddleware: ['csrf'] }, () => {
  route.post('/webhook/stripe', 'WebhookController@handle');
});

route.get('/health', () => ({ ok: true })).withoutMiddleware('throttle');
```

---

## Creating custom middleware

### Class-based (recommended)

```js
// src/Middleware/MaintenanceMode.js
import { Middleware } from '../../engine/middleware/Middleware.js';
import { Response } from '../../engine/http/Response.js';

export class MaintenanceMode extends Middleware {
  async handle(request, next) {
    if (process.env.TAAND_MAINTENANCE === 'true') {
      return Response.text('Be right back', 503);
    }
    return next(request);
  }
}
```

```js
// src/middleware.js
export default function registerAppMiddleware(registry) {
  registry.register('maintenance', MaintenanceMode);
}
```

### Function-based

```js
export function CorsHeaders(request, next) {
  const response = next(request);
  // use terminable middleware class for response headers instead
  return next(request);
}
```

### Parameterized (like `role:admin`)

```js
export class ThrottleRequests extends Middleware {
  static withParams(_app, params) {
    const [max, decay] = params;
    return new ThrottleRequests(_app, max, decay);
  }
}
```

Use on routes: `throttle:100,5` → 100 requests per 5 minutes.

### `lockout` — credential brute-force (login routes)

Taand's `throttle:login` limits by email + IP. Taand uses **`lockout`**:

```js
route.post('/login', 'AuthController@login').middleware('lockout:5,1');
route.post('/register', 'AuthController@register').middleware('lockout:3,5,email');
```

| Param | Meaning |
|-------|---------|
| `5` | Max failed attempts |
| `1` | Decay in minutes |
| `email` | Optional input field (3rd param) |

Counts **failed** attempts only (redirect back to `/login`, 4xx). Clears on successful login. See [attempt-limit.md](./attempt-limit.md).

---

## Request attributes

Share data between middleware and controllers:

```js
request.setAttribute('_user', { id: 1, role: 'admin' });
const user = req.attribute('_user');
```

| Method | Purpose |
|--------|---------|
| `req.setAttribute(key, value)` | Store on request |
| `req.attribute(key, fallback)` | Read from request |
| `req.ip()` | Client IP (proxy-aware) |
| `req.cookies()` | Parsed cookies |

---

## CSRF (web group)

```html
<form method="POST" action="/contact">
  <input type="hidden" name="_token" value="...">
</form>
```

Submit `_token` in the body or send header `X-CSRF-TOKEN`. Token is set via the `csrf` middleware on GET responses.

---

## Terminable middleware

Run after the response is sent:

```js
async terminate(request, response) {
  response.headers['X-Custom'] = 'value';
}
```

Built-in `log`, `security`, and `throttle` use terminable hooks.

---

## Security

| Feature | Detail |
|---------|--------|
| CSRF | Double-submit cookie pattern |
| Body limit | `TAAND_MAX_BODY_SIZE` (10 MB default) |
| Rate limiting | In-memory, no Redis required |
| Security headers | On every response |
| Role gate | Explicit per-route — `role:admin` |
| `withoutMiddleware` | Explicit opt-out only |

---

## Quick reference

```js
// Built-in role gate (framework)
route.get('/admin', 'AdminController@index').middleware(['auth', 'role:admin']);
route.get('/editor', 'EditorController@index').middleware(['auth', 'role:editor']);
route.get('/dashboard', 'DashboardController@index').middleware(['auth', 'role:user']);

// Groups
route.group({ middleware: ['web'] }, () => { /* ... */ });
route.group({ prefix: '/api', middleware: ['api', 'auth'] }, () => { /* ... */ });

// Register custom middleware
// src/middleware.js
registry.register('webAuth', WebAuth);
```

See [routing.md](./routing.md) and [controllers.md](./controllers.md).
