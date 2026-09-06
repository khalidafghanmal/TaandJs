# Attempt limiter & lockout

Block brute-force on login, password reset, and OTP flows. Taand gives you two options:

| Approach | When to use |
|----------|-------------|
| **`lockout` middleware** (recommended) | Route-level — `lockout:5,1` on `POST /login` |
| **`attempt` helper** | Custom logic in controllers, jobs, or APIs |

Both use the **cache store** (file or Redis) for multi-server support.

---

## Route middleware — `lockout` (built-in)

Taand uses `throttle:login` keyed by email + IP. Taand uses **`lockout`** — same idea, Taand naming.

```js
// flow/http.js
route.post('/login', 'AuthController@login').middleware('lockout:5,1');
route.post('/register', 'AuthController@register').middleware('lockout:5,1');
route.post('/forgot-password', 'AuthController@forgot').middleware('lockout:3,5');
```

| Param | Meaning | Example |
|-------|---------|---------|
| 1st | Max **failed** attempts | `5` |
| 2nd | Lockout decay (minutes) | `1` = 60 seconds |
| 3rd | Input field (optional) | `email` (default), `username` |

```js
route.post('/login', 'AuthController@login').middleware('lockout:3,5,username');
```

### How it works

```
POST /login  +  lockout:5,1
      │
      ├─ Already locked?  → 429 Too Many Requests
      │
      ├─ Run controller
      │
      └─ After response:
            ├─ Success (redirect away / 2xx)  → clear counter
            └─ Failure (back to /login, 4xx)  → count attempt
```

Unlike `throttle` (counts every request by IP + path), **`lockout` counts failed credential attempts** keyed by **identity + IP**.

### Taand comparison

| Taand | Taand |
|---------|-------|
| `throttle:login` + `RateLimiter::for('login', …)` | `lockout:5,1` |
| `hasTooManyLoginAttempts()` in controller | Automatic via middleware |
| `incrementLoginAttempts()` | Automatic on failed response |
| `clearLoginAttempts()` | Automatic on success |

---

## Helper — `attempt` (manual)

For custom flows not covered by route middleware:

```js
import { attempt, fail } from '../start/helpers.js';

async login(req) {
  const key = attempt.keyFromRequest(req); // email + IP

  if (await attempt.tooMany(key, 3)) {
    const wait = await attempt.retryIn(key, 300);
    fail(429, `Too many login attempts. Try again in ${wait} seconds.`);
  }

  const ok = await auth().attempt({
    email: req.input('email'),
    password: req.input('password'),
  });

  if (!ok) {
    await attempt.hit(key, 300); // lock window: 5 minutes
    return go.back('/login');
  }

  await attempt.clear(key);
  return go('/dashboard');
}
```

---

## API

| Method | Purpose | Taand |
|--------|---------|---------|
| `attempt.tooMany(key, max)` | `true` when attempts ≥ max | `RateLimiter::tooManyAttempts()` |
| `attempt.count(key)` | Current attempt count | `RateLimiter::attempts()` |
| `attempt.hit(key, seconds)` | Record a failed try + decay TTL | `RateLimiter::hit()` |
| `attempt.clear(key)` | Reset after success | `RateLimiter::clear()` |
| `attempt.retryIn(key, seconds)` | Seconds until retry | `RateLimiter::availableIn()` |
| `attempt.remaining(key, max)` | Attempts left before lock | — |
| `attempt.key(email, ip)` | Build throttle key | `throttleKey()` |
| `attempt.keyFromRequest(req)` | Key from request email + IP | — |
| `attempt.ensure(key, max, seconds)` | Throw 429 if already locked | — |

Import:

```js
import attempt from '../start/attempt.js';
// or
import { attempt } from '../start/helpers.js';
```

---

## Typical flow

```
POST /login
    │
    ├─ tooMany(key, 3)?  → 429 + retry message
    │
    ├─ validate credentials
    │
    ├─ failed?  → hit(key, 300)
    │
    └─ success  → clear(key) → redirect
```

| Step | When |
|------|------|
| Check `tooMany` | **Before** processing the action |
| `hit` | **After** each failed attempt |
| `clear` | **After** success (valid login, correct OTP, etc.) |

---

## Dynamic limits

`max` and decay are per call — not global config:

```js
const max = Number(cfg('auth.loginMaxAttempts', 5));
const decay = Number(cfg('auth.loginDecaySeconds', 900));

if (await attempt.tooMany(key, max)) { /* ... */ }
await attempt.hit(key, decay);
```

Example `.env` + `config/auth.js`:

```env
TAAND_LOGIN_MAX_ATTEMPTS=3
TAAND_LOGIN_DECAY_SECONDS=300
```

```js
// config/auth.js
loginMaxAttempts: Number(env('TAAND_LOGIN_MAX_ATTEMPTS', '5')),
loginDecaySeconds: Number(env('TAAND_LOGIN_DECAY_SECONDS', '900')),
```

---

## Custom keys

By IP only:

```js
const key = `attempt:ip:${req.ip()}`;
```

By user id:

```js
const key = `attempt:user:${userId}`;
```

By action:

```js
const key = attempt.key(email, req.ip()) + ':reset-password';
```

Use stable, non-guessable segments for user identifiers in public APIs.

---

## `ensure()` — fail fast

```js
await attempt.ensure(key, 3, 300); // throws HttpError 429 if locked
// safe to continue…
```

Thrown error includes `retryAfter` (seconds) when available.

---

## vs `throttle` vs `lockout` vs `attempt`

| | `throttle` | `lockout` | `attempt` helper |
|--|------------|-----------|------------------|
| Scope | Any route | Auth / credential routes | Anywhere in code |
| Key | IP + method + path | identity + IP | You choose |
| Counts | Every request | Failed attempts only | You control |
| Usage | `throttle:60,1` | `lockout:5,1` | `attempt.hit(key)` |

Use **`throttle`** on APIs for general abuse. Use **`lockout`** on login/register. Use **`attempt`** for OTP, API keys, or custom rules.

---

## Storage

Backed by `engine/http/RateLimiter.js` → `cache` store.

| Cache driver | Multi-server |
|--------------|--------------|
| `file` | Single server |
| `redis` | Shared across instances |

Set `REDIS_URL` and `TAAND_CACHE_STORE=redis` for production clusters. See [redis.md](./redis.md).

---

## See also

- [helpers.md](./helpers.md) — all helpers
- [auth.md](./auth.md) — session authentication
- [auth-scaffolding.md](./auth-scaffolding.md) — taandb login kit (built-in lockout)
- [cache.md](./cache.md) — cache drivers
- [middleware.md](./middleware.md) — `throttle` and `lockout` middleware
