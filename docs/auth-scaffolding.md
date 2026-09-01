# Auth scaffolding (taandb)

Login, register, dashboard, and password reset — installed into your app from bundled stubs (same as the standalone `@taandb/auth` kit).

---

## Quick start — new project with auth

```bash
# From Taand monorepo
node bin/create.js ../my-app --auth

# Or after publishing
npm create taand@latest my-app -- --auth
```

Existing project:

```bash
cd my-app
npm run auth:install
npm run db:migrate
npm run dev
```

Open `http://127.0.0.1:2977/login`

---

## How it is structured

```
create-taand --auth
       │
       ▼
bin/install-auth.js
       │
       ├─ Copy stubs/taandb/*  →  src/, flow/, ui/, config/, web/
       ├─ Patch flow/http.js  →  import './taandb.js'
       └─ Write .taandb/manifest.json  (install record for uninstall)
```

### Files added to your app

| Path | Purpose |
|------|---------|
| `flow/taandb.js` | Auth route table (login, register, reset, …) |
| `flow/http.js` | Patched with `import './taandb.js'` |
| `src/actions/taandbAuthController.js` | Login, register, forgot/reset password |
| `src/actions/taandbDashboardController.js` | Protected dashboard |
| `src/taandb/taandbGuard.js` | Lockout, honeypot, password policy |
| `config/taandb.js` | Auth kit config (min password, lockout, …) |
| `ui/taandb/*.taand` | Login/register UI templates |
| `web/css/taandb.css` | Auth pages styling |
| `.taandb/manifest.json` | Installed file list |

### Request flow (login)

```
GET /login
  → web group (startSession, csrf)
  → guest middleware
  → taandbAuthController@showLogin
  → ui/taandb/login.taand

POST /login
  → web group + lockout
  → taandbGuard (honeypot, password verify)
  → session _user_id set
  → redirect /dashboard
```

Auth uses the **framework core** — no duplicate CSRF or session code:

- Sessions → `engine/middleware/StartSession.js`
- CSRF → `engine/middleware/web/CsrfProtection.js`
- Password hash → `engine/auth/Hasher.js` (scrypt)
- Roles → `config/auth.js` + `role` middleware

---

## Routes installed

| Method | Path | Action |
|--------|------|--------|
| GET | `/login` | Login form |
| POST | `/login` | Authenticate |
| GET | `/register` | Register form |
| POST | `/register` | Create account |
| POST | `/logout` | End session |
| GET | `/dashboard` | Protected home (auth middleware) |
| GET/POST | `/forgot-password` | Request reset |
| GET/POST | `/reset-password` | Set new password |

---

## Configuration

`config/taandb.js` (after install):

```js
export default {
  passwordMin: 12,
  passwordMinScore: 3,
  maxAttempts: 5,
  lockoutMinutes: 15,
  resetTtlMinutes: 60,
};
```

Override via `.env`:

```env
TAANDB_PASSWORD_MIN=12
TAANDB_MAX_ATTEMPTS=5
TAANDB_LOCKOUT_MINUTES=15
```

---

## Framework vs app boundary

```
Taand/framework (kernel)
├── Auth primitives (session, Hasher, Gate, middleware)
├── stubs/taandb/          ← source templates (not copied to new apps by default)
└── bin/install-auth.js  ← installer used by create --auth

Your app (after --auth)
├── src/actions/taandb*.js
├── flow/taandb.js
└── ui/taandb/
```

The framework stays clean; auth UI lives in **your app** after install. Upgrade the kit by re-running `npm run auth:install -- --force` ( backs up first if needed).

---

## Standalone taandb package

The `taandb/` folder in the monorepo is the same kit for manual install:

```bash
cd taandb
node bin/taandb.js install ../TaandJs
```

`npm run auth:install` inside Taand uses bundled `stubs/taandb/` — no taandb folder required.

---

## Taand comparison

| Taand | Taand |
|---------|-------|
| `npm create taand -- --auth` | `npm create taand -- --auth` |
| `npm run auth:install` | `npm run auth:install` |
| `flow/auth.php` | `flow/taandb.js` |
| Blade views | `ui/taandb/*.taand` |

---

## See also

- [auth.md](./auth.md) — session guards, roles, policies
- [middleware.md](./middleware.md) — web group, CSRF, throttle
- [validation.md](./validation.md) — form validation rules
