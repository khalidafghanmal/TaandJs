# Testing

Taand uses Node.js built-in test runner — no extra test framework required.

```bash
npm test
```

## Coverage

| File | Area |
|------|------|
| `specs/routing.test.js` | Routes, groups, params, 404/405, redirects |
| `specs/validation-rules.test.js` | All validation rules |
| `specs/validation-db.test.js` | Prisma `unique` / `exists` rules |
| `specs/auth.test.js` | Password hashing, Gate authorization |
| `specs/views.test.js` | Template compiler, XSS escaping |
| `specs/security.test.js` | CSRF, rate limit, redirect safety, headers |
| `specs/http-request.test.js` | Request parsing, input, cookies |
| `specs/pagination.test.js` | Paginator + JsonResource |
| `specs/cli.test.js` | CLI commands |
| `specs/modules.test.js` | Feature modules (discovery, routes, views, security) |
| `specs/lockout.test.js` | Lockout middleware (route brute-force) |
| `specs/attempt.test.js` | Attempt limiter helper (brute-force lockout) |
| `specs/cache.test.js` | Cache put/get/remember/increment |
| `specs/queue.test.js` | Queue array driver, dispatch |
| `specs/mail.test.js` | Mail array/null drivers |
| `specs/events.test.js` | Event dispatcher, wildcards, halt |

Shared helpers live in `specs/helpers/setup.js` (`miniApp`, `req`, `dispatch`).

## Writing tests

Keep tests **fast and isolated** — use `miniApp()` instead of booting the full server:

```js
import { miniApp, req, dispatch } from './helpers/setup.js';

const { router } = miniApp();
router.get('/ping', () => ({ pong: true }));
const res = await dispatch(router, req('/ping'));
```
