# Routing

TaandJs routing mirrors Taand's `Route` facade — same verbs, groups, parameters, middleware, and fluent chaining. Routes are registered once at boot (or hot-reloaded in dev), compiled to fast lookups, and dispatched through the HTTP kernel.

## Route file

All routes belong in `flow/http.js`. The application loads this file automatically during bootstrap. Edit it and save — the dev server hot-reloads routes without a restart.

```js
import route from '../start/route.js';

route.get('/', 'HomeController@index');
```

## HTTP verbs

Every standard verb is supported. `GET` routes also answer `HEAD` automatically (empty body, same handler logic).

| Verb | Registrar | Typical use |
|------|-----------|-------------|
| GET | `route.get(uri, action)` | Pages, reads, APIs |
| POST | `route.post(uri, action)` | Form submits, creates |
| PUT | `route.put(uri, action)` | Full updates |
| PATCH | `route.patch(uri, action)` | Partial updates |
| DELETE | `route.delete(uri, action)` | Removes |
| OPTIONS | `route.options(uri, action)` | CORS preflight |

### Multiple verbs on one URI

Use `match` when one handler should accept several methods:

```js
route.match(['GET', 'POST'], '/contact', 'ContactController@handle');
```

Use `any` when every verb should hit the same handler (rare — prefer explicit verbs):

```js
route.any('/webhook', 'WebhookController@receive');
```

## Route actions

An action is either a **closure** or a **controller string**:

| Form | Example |
|------|---------|
| Closure | `(req) => Response.json({ ok: true })` |
| Controller | `'HomeController@index'` |
| Controller array | `[HomeController, 'index']` |

Closures receive the `Request` instance. Controllers are resolved from `src/actions/` — see [controllers.md](./controllers.md).

## Return values

Handlers may return any of the following. The framework normalizes them into a proper HTTP response:

| Return | Result |
|--------|--------|
| `string` | HTML (`text/html`) |
| Plain `object` | JSON (`application/json`) |
| `Response` instance | Full control over status, headers, body |
| `view('name')` / `view('name', data)` | Rendered Taand template |
| `Redirect.to('/path')` | Secure relative redirect |
| `Promise` | Awaited, then resolved as above |

## Request object

Every handler receives a `Request` with safe, parsed input:

| Property / method | Description |
|-------------------|-------------|
| `req.method` | Uppercase HTTP verb |
| `req.path` | URL pathname (no query string) |
| `req.query` | Query string as a plain object |
| `req.params` | Route parameters (`{id}`, etc.) |
| `req.headers` | Raw Node headers |
| `req.header(name)` | Single header (case-insensitive) |
| `req.body` | Raw request body (max `TAAND_MAX_BODY_SIZE`, 10 MB default) |
| `req.json()` | Parsed JSON body (`application/json` only) |
| `req.form()` | Parsed form body (`application/x-www-form-urlencoded`) |
| `req.input(key, fallback)` | JSON → form → query → route param (first match) |
| `req.all()` | Merged form, JSON, query, and route params |
| `req.isMethod('POST')` | `true` when method matches |

POST and PUT handlers should read input through `req.input()` or `req.json()` — never trust raw `req.body` without parsing.

## Route parameters

Dynamic segments use `{name}` syntax:

```js
route.get('/users/{id}', (req) => {
  return { user: req.params.id };
});
```

Parameters are URL-decoded and injected into `req.params` before the handler runs.

### Constraints (`where`)

Restrict what a parameter may contain. Patterns are validated at registration time — unsafe regex is rejected.

```js
route
  .get('/users/{id}', 'UserController@show')
  .where('id', '\\d+');

route
  .get('/posts/{slug}', 'PostController@show')
  .where({ slug: '[a-z0-9-]+' });
```

## Named routes

Name routes for URL generation and debugging:

```js
route.get('/users/{id}', 'UserController@show').name('users.show');
```

Inside a group with a `name` prefix, only the suffix is required:

```js
route.group({ prefix: '/api', name: 'api' }, () => {
  route.get('/health', () => ({ ok: true })).name('health');
  // full name: api.health
});
```

Generate URLs from names:

```js
route.url('users.show', { id: 42 }); // → /users/42
```

Missing names or parameters throw a clear `[Taand]` error at call time.

## Route groups

Groups apply shared attributes to every route registered inside the callback:

```js
route.group({ prefix: '/api', middleware: ['auth'], name: 'api' }, () => {
  route.get('/profile', 'ProfileController@show').name('profile');
  // GET /api/profile — middleware: auth — name: api.profile
});
```

| Attribute | Effect |
|-----------|--------|
| `prefix` | Prepended to each URI (`/api` + `/users` → `/api/users`) |
| `middleware` | Merged onto each route (string or array) |
| `name` | Prepended to each `.name()` call (`api` + `health` → `api.health`) |

Groups can be nested. Prefixes and name prefixes stack; middleware arrays merge in order.

## Per-route middleware

Attach middleware to a single route with fluent chaining:

```js
route
  .post('/settings', 'SettingsController@update')
  .middleware('auth');

// Role gates — taand-style role:admin (see middleware.md)
route.get('/admin', 'AdminController@index').middleware(['auth', 'role:admin']);

// Skip specific middleware
route.post('/webhook', 'WebhookController@handle')
  .middleware('web')
  .withoutMiddleware('csrf');
```

Route middleware runs **after** global middleware and **before** the handler. Auth, roles, and login examples: [middleware.md](./middleware.md).

## Redirect routes

Register a GET redirect without a dedicated controller:

```js
route.redirect('/old-page', '/new-page');           // 302
route.redirect('/legacy', '/home', 301);            // permanent
```

Only relative paths starting with `/` are allowed — open redirects are blocked.

## Fallback routes

When no route matches the path, Taand returns **404**. Register a fallback to handle unmatched URLs (SPA shells, custom error pages):

```js
route.fallback((req) => view('errors.404'));
```

Fallback runs only when the path does not match any registered route. It does **not** run when the path matches but the HTTP method is wrong.

## Method not allowed (405)

When the path matches a route but the HTTP verb does not, Taand responds with **405 Method Not Allowed** and an `Allow` header listing valid verbs for that path.

Example: `POST /` when only `GET /` is registered → `405` with `Allow: GET, HEAD`.

## Security

| Measure | Detail |
|---------|--------|
| Body size limit | `TAAND_MAX_BODY_SIZE` (10 MB default) — oversized bodies get 413 |
| JSON parsing | Only when `Content-Type` is `application/json` |
| Redirects | Relative paths only; `..` and protocol-relative URLs blocked |
| Route patterns | `where` patterns screened for unsafe constructs |
| Response headers | `X-Content-Type-Options`, `X-Frame-Options`, and related defaults on every response |

Authentication, CSRF, rate limiting, and validation belong in [middleware](./middleware.md) — not in route definitions.

## Performance

Routes are compiled at registration time, not on each request:

| Route type | Matching |
|------------|----------|
| Static (`/about`) | O(1) `Map` lookup per HTTP method |
| Dynamic (`/users/{id}`) | Pre-compiled `RegExp` — no runtime path parsing |
| HEAD on GET routes | Served from the GET route without duplicating registration |

Static routes are checked before dynamic routes. Register specific paths before catch-all patterns for best match order.

## Hot reload

In development, saving `flow/http.js` clears the route table and reloads the file. Named routes, groups, and fallback handlers are re-registered on each reload.

## Quick reference

```js
import route from '../start/route.js';

// Verbs
route.get(uri, action);
route.post(uri, action);
route.put(uri, action);
route.patch(uri, action);
route.delete(uri, action);
route.options(uri, action);
route.match(['GET', 'POST'], uri, action);
route.any(uri, action);

// Utilities
route.redirect(from, to, status = 302);
route.fallback(action);
route.url(name, params);

// Groups
route.group({ prefix, middleware, name }, () => { /* routes */ });

// Fluent chain (return value of any verb above)
route.get('/items/{id}', action)
  .name('items.show')
  .middleware('auth')
  .where('id', '\\d+');
```
