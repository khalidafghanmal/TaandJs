# Authentication & Authorization

TaandJs ships **production-grade session authentication** — Taand's security model without PHP or extra packages. Server-side sessions, signed cookies, scrypt passwords, remember-me, CSRF, role gates, and policy-based authorization are all built in.

## What's included

| Feature | Detail |
|---------|--------|
| Session auth | File-based store, signed session ID cookie |
| Password hashing | Node `scrypt` — no bcrypt dependency |
| Remember me | Signed cookie + hashed token in database |
| Guards | `session` (web) and `api` (Bearer token) |
| Roles | `role:admin`, `role:admin,editor` middleware |
| Gates | `can:content.manage` — config + custom abilities |
| Policies | Class-based resource authorization |
| CSRF | Session-backed token + `{{ csrf_field() }}` |
| Rate limiting | Login/register lockout (`lockout:5,1`) |

---

## Quick start

```bash
cd Taand
cp .env.example .env
npm install
npm run db:migrate
npm run dev
```

Add your own login/register routes and controllers — see **Routes** and **Controllers** below.

---

## How it works

```
Browser → startSession → csrf → auth → role/can → Controller
                ↓
     storage/sessions/sess_{id}
                ↓
         Signed taand_session cookie
```

1. **`startSession`** loads or creates a server-side session (web group).
2. **`auth`** middleware loads the user from `_user_id` in session (or remember cookie).
3. **`role`** / **`can`** enforce authorization before the controller runs.
4. On response, the session is saved and cookies are set (terminable middleware).

---

## Configuration

`config/auth.js` — guards, session lifetime, role permissions:

```js
export default {
  default: 'session',
  guards: {
    session: { driver: 'session', provider: 'users' },
    api: { driver: 'token', provider: 'users' },
  },
  session: {
    lifetime: 120,        // minutes
    cookie: 'taand_session',
    secure: false,        // set true behind HTTPS
    sameSite: 'lax',
    rememberDays: 14,
  },
  roles: {
    hierarchy: { admin: 100, editor: 50, user: 10 },
    permissions: {
      admin: ['*'],
      editor: ['content.manage', 'content.view', 'profile.edit'],
      user: ['content.view', 'profile.edit'],
    },
  },
};
```

### Environment

```env
TAAND_APP_KEY=your-random-32-char-secret
TAAND_SESSION_LIFETIME=120
TAAND_SESSION_SECURE=false
TAAND_REMEMBER_DAYS=14
TAAND_API_TOKEN=optional-api-token
```

**Always set a strong `TAAND_APP_KEY` in production** — it signs sessions, remember cookies, and CSRF tokens.

---

## Routes & middleware

```js
import route from '../start/route.js';

route.group({ middleware: ['web'] }, () => {
  route.group({ middleware: ['guest'] }, () => {
    route.get('/login', 'AuthController@showLogin');
    route.post('/login', 'AuthController@login').middleware('lockout:5,1');
    route.get('/register', 'AuthController@showRegister');
    route.post('/register', 'AuthController@register').middleware('lockout:5,1');
  });

  route.post('/logout', 'AuthController@logout').middleware('auth');
});

route.get('/dashboard', 'DashboardController@index').middleware(['web', 'auth']);
route.get('/admin', 'AdminController@index').middleware(['web', 'auth', 'role:admin']);
route.get('/editor', 'EditorController@index').middleware(['web', 'auth', 'can:content.manage']);

route.group({ prefix: '/api', middleware: ['api', 'auth:api'] }, () => {
  route.get('/me', (req) => ({ user: req.attribute('_user') }));
});
```

| Middleware | Usage | Behavior |
|------------|-------|----------|
| `web` | Route group | `startSession` + `csrf` |
| `auth` | Protected pages | Session guard — redirects to `/login` |
| `auth:api` | API routes | Bearer / `X-Api-Key` token |
| `guest` | Login/register | Redirects authenticated users away |
| `role:admin` | Admin only | Exact role or comma list (`role:admin,editor`) |
| `can:ability` | Gate check | Policy or config permission |
| `lockout:5,1` | Brute-force protection | 5 failed logins per minute (email + IP) |
| `throttle:60,1` | General rate limit | 60 requests per minute (IP + path) |

---

## Controllers

```js
import { Controller } from '../../engine/core/Controller.js';
import auth from '../../start/auth.js';
import session from '../../start/session.js';

export class ProfileController extends Controller {
  async update(req) {
    const user = this.user(req);

    if (!(await this.can(req, 'profile.edit'))) {
      return { error: 'Forbidden' };
    }

    // ...
  }

  async destroy(req) {
    await this.authorize(req, 'manage-users');
    // throws 403 if denied
  }
}
```

### Helpers

| Method | Purpose |
|--------|---------|
| `this.user(req)` | Current authenticated user |
| `this.auth(req)` | Full auth API (`attempt`, `login`, `logout`) |
| `this.can(req, ability)` | Check gate — returns boolean |
| `this.authorize(req, ability)` | Deny with 403 if not allowed |
| `this.viewFor(req, name, data)` | View with `_csrf` and `auth` injected |

### Auth API

```js
import auth from '../start/auth.js';

await auth(req).attempt({ email, password }, remember = false);
await auth(req).login(user);
await auth(req).logout();

auth(req).check();   // boolean
auth(req).user();    // { id, name, email, role }
auth(req).id();      // user id or null
auth(req).flash('error'); // read flashed message
```

### Session helper

Taand sessions are server-side (file store) and attached to the request by `startSession`.

```js
import session from '../start/session.js';

// Request-aware API (recommended)
session.for(req).get('key');
session.for(req).put('key', 'value');
session.for(req).flash('status', 'Saved');
```

---

## Views

CSRF and auth are auto-injected via `viewFor()`:

```html
<form method="POST" action="/login">
  {{ csrf_field() }}
  <input type="email" name="email">
  <input type="password" name="password">
  <button type="submit">Sign in</button>
</form>

@if($auth)
  <p>Hello, {{ $auth.name }} ({{ $auth.role }})</p>
@end
```

| Helper | Output |
|--------|--------|
| `{{ csrf_field() }}` | Hidden `_token` input |
| `{{ csrf_token() }}` | Raw token string |

---

## Authorization

### Gates (`config/auth.js` + `src/policies.js`)

```js
// src/policies.js
export default function registerPolicies(gate) {
  gate.define('content.manage', (user) =>
    user.role === 'admin' || user.role === 'editor',
  );

  gate.define('manage-users', (user) => user.role === 'admin');
}
```

Permissions in `config/auth.js` under `roles.permissions` are checked automatically:

```js
// user with role "editor" automatically passes can:content.manage
route.get('/editor', 'EditorController@index').middleware('can:content.manage');
```

### Policies (resource-based)

```js
import { Policy } from '../../engine/auth/Policy.js';

export class PostPolicy extends Policy {
  update(user, post) {
    return user.id === post.userId || user.role === 'admin';
  }
}
```

Register in `src/policies.js`:

```js
gate.policy('Post', PostPolicy);
```

---

## Security

| Measure | Implementation |
|---------|----------------|
| Password storage | scrypt with 16 KB memory cost |
| Timing attacks | Constant-time compare on tokens/passwords |
| Session fixation | Session ID regenerated on login |
| Session cookie | HttpOnly, Signed (HMAC-SHA256), SameSite |
| Remember me | Separate signed cookie; token hashed in DB |
| API tokens | Per-user PATs (SHA-256 hash); optional env fallback |
| CSRF | Session token + double-submit cookie |
| Login lockout | `lockout:5,1` on login & register (5 failed attempts/minute) |
| User enumeration | Same error message for bad email vs bad password |
| Open redirects | Blocked — only relative paths allowed |

---

## API authentication

Taand supports **Sanctum-style personal access tokens** — per-user Bearer tokens stored as SHA-256 hashes in the database. Each token is issued once in `{id}|{secret}` format; only the hash is persisted.

### Create a token (logged-in user)

```javascript
// In a controller after session auth
const { plainTextToken, name, abilities } = await auth(request).createToken('mobile-app', ['profile.edit']);
// Return plainTextToken to the client once — it cannot be retrieved again
```

```javascript
// List / revoke
await auth(request).tokens();
await auth(request).revokeToken(tokenId);
await auth(request).revokeAllTokens();
```

Run migrations so `PersonalAccessToken` exists:

```bash
npm run db:migrate
```

### Authenticate API requests

```bash
curl -H "Authorization: Bearer 1|your-plain-text-token" http://127.0.0.1:2977/api/me
```

`X-Api-Key` is also accepted. Use `auth:api` middleware on API route groups. Authenticated users include real `id`, `email`, and `role` for Gate / `can:` checks.

Optional token abilities:

```javascript
await auth(request).tokenCan('profile.edit'); // scoped to current access token
```

### Machine-to-machine fallback

`TAAND_API_TOKEN` remains available for service accounts that do not map to a user (no `id` / `role`). Prefer personal access tokens for user-scoped API access.

```bash
# .env
TAAND_API_TOKEN=optional-machine-token
TAAND_TOKEN_PREFIX=
TAAND_TOKEN_EXPIRATION_DAYS=0
```

---

## File reference

```
config/auth.js                    # Guards, session, roles, permissions
src/auth/
  AuthManager.js                  # Login, logout, guards
  SessionStore.js                 # File session driver
  Hasher.js                       # scrypt passwords
  Gate.js                         # Authorization gates
  UserProvider.js                 # Prisma user repository
src/middleware/
  StartSession.js                 # Session lifecycle
  Authenticate.js                 # auth / auth:api
  auth/RoleMiddleware.js          # role:admin
  auth/Authorize.js               # can:ability
src/policies.js                   # Custom gates
start/auth.js                 # auth(req) helper
```

---

## vs Taand

| Taand | Taand |
|---------|-------|
| `npm run db:migrate` | `npm run db:migrate` |
| `Auth::attempt()` | `auth(req).attempt()` |
| `middleware('auth')` | Same |
| `middleware('role:admin')` | Same |
| `middleware('can:edit,post')` | `middleware('can:edit')` + policies |
| Session in `storage/sessions` | Same path pattern |
| Bcrypt via `Hash::make()` | scrypt via `Hasher` (built into Node) |

Taand needs **zero extra auth packages** — sessions, hashing, and gates are framework-native.

---

## Helper shortcuts

| Task | Helper |
|------|--------|
| Current user | `user()` — see [helpers.md](./helpers.md) |
| Check permission | `can('content.manage')` |
| Enforce permission | `authorize('content.manage')` |
| Safe back redirect | `back()` / `go.back()` |
