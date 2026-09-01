# Helpers

Taand helpers use **short, simple names** — not Taand copies. Security is built in: crypto tokens, open-redirect-safe `back()`, fail-closed `can()`, and HTML escaping via `e()`.

Import one barrel file or individual helpers from `start/`:

```js
import {
  cfg, env, path, go, fail, reply, bag, text, none, some, maybe, tick, peek, halt, prev,
  uuid, token, user, can, authorize, back, url, tap, when, unless, e, pass, errors, attempt, dispatch,
} from '../start/helpers.js';
```

Inside HTTP handlers, many helpers work **without passing `request`** thanks to request context (`AsyncLocalStorage`).

---

## Quick reference

| Helper | Does | taand-ish |
|--------|------|-------------|
| `cfg('app.name')` | Read config | `config()` |
| `env('KEY', 'default')` | Read `.env` | `env()` |
| `path('users.show', { id: 1 })` | Named route URL | `route()` |
| `url('/dashboard')` | Absolute app URL | `url()` |
| `go('/dashboard')` | Redirect | `redirect()` |
| `go.path('home')` | Redirect to named route | `redirect()->route()` |
| `go.back()` | Safe back redirect | `back()` |
| `back(req, '/fallback')` | Same-origin Referer redirect | `back()` |
| `fail(404)` | Throw HTTP error | `abort()` |
| `reply.json({ ok: true })` | Build response | `response()->json()` |
| `uuid()` | RFC 4122 UUID | `Str::uuid()` |
| `token(32)` | Crypto random token | `Str::random()` (secure) |
| `user()` / `user(req)` | Current auth user (public fields) | `auth()->user()` |
| `can('edit', post)` | Authorization check | `Gate::allows()` |
| `authorize('edit', post)` | Throws 403 if denied | `Gate::authorize()` |
| `bag(items)` | List/collection helper | `collect()` |
| `text('Hi').slug()` | String helper | `str()` |
| `none(x)` / `some(x)` | Empty / has value | `blank()` / `filled()` |
| `maybe(obj).get('name')` | Safe access + chain | `optional()` |
| `tick().addDays(7)` | Date helper | `now()` |
| `today()` | Start of today | `today()` |
| `tap(v, fn)` | Side effect, return value | `tap()` |
| `when(cond, a, b)` | Conditional value | `value()` |
| `unless(cond, a, b)` | Inverse conditional | — |
| `e(str)` | HTML escape | `e()` |
| `pass({ user, title })` | Safe view data (strips secrets) | `compact()` |
| `errors('email')` | First validation error | `$errors->first()` |
| `dispatch(job)` | Queue job | `dispatch()` |
| `peek(data)` | Debug log | `dump()` |
| `halt(data)` | Debug stop | `dd()` |
| `prev(req, 'email')` | Old form input | `old()` |
| `attempt.tooMany(key, 3)` | Brute-force lock check | `RateLimiter::tooManyAttempts()` |
| `attempt.hit(key, 300)` | Record failed try | `RateLimiter::hit()` |
| `attempt.clear(key)` | Reset on success | `RateLimiter::clear()` |

Route-level: `lockout:5,1` on `POST /login` — see [attempt-limit.md](./attempt-limit.md).

## Tier 1 — Security-critical helpers

### `uuid()` and `token(bytes)`

```js
import { uuid, token } from '../start/helpers.js';

const id = uuid();
const resetToken = token(32); // minimum 16 bytes entropy
```

| Rule | Detail |
|------|--------|
| Use `token()` for secrets | Reset links, API keys, signed payloads |
| Never use `Math.random()` | `Text.random()` now delegates to crypto — prefer `token()` |
| Minimum entropy | `token(n)` throws if `n < 16` |

Implementation: [`engine/support/Crypto.js`](../engine/support/Crypto.js)

### `user()` — current authenticated user

```js
import user from '../start/user.js';

export class PostController {
  async index() {
    const authUser = user(); // works inside HTTP request
    if (!authUser) return { guest: true };
    return { name: authUser.name, role: authUser.role };
  }
}
```

| Security | Detail |
|----------|--------|
| Public fields only | Never includes `password` — same as session auth |
| Null when guest | Always check before use |
| Request scope | Returns `null` outside HTTP handlers |

### `can()` / `authorize()` — authorization

```js
import { can, authorize } from '../start/can.js';

if (await can('content.manage')) { /* ... */ }

await authorize('content.manage'); // throws 403 if denied
```

| Security | Detail |
|----------|--------|
| Fail closed | No user → `can()` is `false`, `authorize()` throws 403 |
| Uses Gate | Same as middleware `can:` / policies |

### `back()` — safe redirect

```js
import back from '../start/back.js';

return back(request, '/dashboard');
return go.back('/login');
```

| Security | Detail |
|----------|--------|
| Same-origin Referer only | External referers → fallback |
| Blocks `..` and `\` | Path traversal rejected |
| Relative paths only | Uses `Redirect.sanitize()` |

Implementation: [`engine/support/SafeBack.js`](../engine/support/SafeBack.js)

### `url()` — absolute URLs

```js
import url from '../start/url.js';

const link = url('/reset-password?token=abc');
```

Set in `.env`:

```env
TAAND_APP_URL=http://127.0.0.1:2977
```

| Security | Detail |
|----------|--------|
| Rejects absolute input | `url('https://evil.com')` throws |
| Builds from app base | Prevents open URL injection |

### `pass()` — safe view data

`compact('user')` is not safe in JavaScript (needs `eval`). Use **`pass({ user })`** instead — same DX, strips secrets before templates see them.

```js
import { view, pass } from '../start/helpers.js';

const user = await db.user.findUnique({ where: { id: 1 } });

return view('hello', pass({ user }));
return view('dashboard', pass({ user, posts, title: 'Home' }));
return this.viewFor(req, 'auth.login', pass({ title: 'Login' }));
```

| Security | Detail |
|----------|--------|
| Strips sensitive keys | `password`, `passwordHash`, `rememberToken`, `apiToken`, `secret`, … |
| Blocks prototype keys | `__proto__`, `constructor`, `prototype` |
| Plain values only | Dates → ISO strings; nested objects sanitized |
| Optional allow-list | `pass({ user }, { keys: { user: ['id', 'name', 'email'] } })` |

Implementation: [`engine/support/Pass.js`](../engine/support/Pass.js)

---

## Tier 2 — DX helpers

### `tap`, `when`, `unless`

```js
import { tap, when, unless } from '../start/helpers.js';

const payload = tap(await load(), (data) => log.debug('loaded', { id: data.id }));
const label = when(user, user.name, 'Guest');
```

### `e()` — HTML escape

```js
import e from '../start/e.js';

return reply.html(`<p>${e(userInput)}</p>`);
```

Use in views: `{{ e($title) }}` — redundant-safe with default `{{ }}` escaping.

### `errors()` — validation messages

```js
import errors from '../start/errors.js';

const emailError = errors(request, 'email');
```

In views (with `viewFor()`):

```html
<input name="email" value="{{ prev('email') }}">
@if some(errors('email'))
  <p class="error">{{ errors('email') }}</p>
@end
```

### `dispatch()` — queue jobs

```js
import { dispatch } from '../start/helpers.js';
await dispatch(new SendWelcomeEmail(app, { userId: 1 }));
```

### `attempt()` — brute-force limiter

```js
import { attempt, fail } from '../start/helpers.js';

const key = attempt.keyFromRequest(req);

if (await attempt.tooMany(key, 3)) {
  fail(429, 'Too many attempts');
}

if (!loggedIn) {
  await attempt.hit(key, 300);
}

await attempt.clear(key);
```

Full guide: [attempt-limit.md](./attempt-limit.md).

---

## Tier 3 — Extended `bag()`, `text()`, `maybe()`

### `bag()` collections

```js
import { bag } from '../start/bag.js';

const admins = bag(users)
  .where('role', 'admin')
  .sortBy('name')
  .pluck('email');

const byRole = bag(users).groupBy('role');
const uniqueEmails = bag(users).unique('email');
```

Unsafe keys (`__proto__`, `constructor`) are ignored when plucking/grouping.

### `text()` strings

```js
import { text } from '../start/text.js';

text('Hello').contains('ell');        // true
text('secret@test.com').mask('email'); // s***@test.com
text('1234567890').redact();           // 12*****890
```

Use `mask()` / `redact()` for logs and UI — **not** for authorization decisions.

### `maybe()` chains

```js
import { maybe } from '../start/value.js';

const label = maybe(user).get('name').or('Guest');
const doubled = maybe({ n: 2 }).when((v) => v.n > 1, (v) => v.n * 2);
```

---

## View helpers

Available inside `.taand` templates:

| Helper | Example |
|--------|---------|
| `e()` | `{{ e($title) }}` |
| `errors()` | `{{ errors('email') }}` |
| `classNames()` | `class="{{ classNames({ active: $isActive, btn: true }) }}"` |
| `selected()` | `<option {{ selected('role', 'admin') }}>` |
| `checked()` | `<input {{ checked('terms', 'on') }}>` |
| `prev()` | `{{ prev('email') }}` |
| `asset()` / `storage()` | Public & upload URLs |
| `csrf_field()` | Hidden CSRF input |

Invalid CSS class names are stripped from `classNames()`.

---

## Request context

During an HTTP request, helpers resolve the current request automatically:

```
HTTP request → RequestContext.run(request) → helpers (user, back, errors, can)
```

Outside a request (CLI, tests), pass `request` explicitly or expect `null`.

---

## Security summary

| Threat | Helper / mechanism |
|--------|------------------|
| Weak random tokens | `token()` via `crypto.randomBytes` |
| Open redirect | `back()` / `SafeBack` same-origin + sanitize |
| XSS | `e()` / default `{{ }}` escaping |
| Unauthorized access | `can()` / `authorize()` fail closed |
| Prototype pollution | `bag()` safe key reads |
| PII in logs | `text().mask()` / `redact()` |

---

## Existing facades

Still available from `start/`:

- `cache`, `log`, `session`, `auth`, `validate`, `view`, `db`, `mail`, `queue`, `event`, `asset`, `storage`

See [auth.md](./auth.md) for guards and policies, [cache.md](./cache.md), [controllers.md](./controllers.md).
