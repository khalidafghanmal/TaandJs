# Auth scaffolding (taandb)

> **Not available yet.** This repository does not ship an auth scaffolding kit: there is no `npm run auth:install` script, no `bin/install-auth.js` or `bin/taandb.js`, no bundled `stubs/taandb/` templates, and `create-taand` has no `--auth` flag. This page will be filled in when the kit lands.

## What you can use today

The framework core already provides the auth building blocks; wire your own login/register routes on top of them:

| Piece | Location |
|-------|----------|
| Sessions | `engine/middleware/StartSession.js` (`startSession`, in the `web` group) |
| CSRF | `engine/middleware/web/CsrfProtection.js` (`csrf`, in the `web` group) |
| Password hashing | `engine/auth/Hasher.js` (scrypt) |
| Auth manager / guards | `engine/auth/AuthManager.js` |
| Login brute-force limits | `lockout` middleware, [attempt-limit.md](./attempt-limit.md) |
| Roles & permissions | `settings/security.js` → `roles`, `role` / `can` middleware |
| Login / register / home paths | `settings/security.js` → `browser.pages` |

## See also

- [auth.md](./auth.md) — session guards, roles, policies
- [middleware.md](./middleware.md) — web group, CSRF, throttle
- [validation.md](./validation.md) — form validation rules
