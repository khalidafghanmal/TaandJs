# Changelog

All notable changes to TaandJs are documented here.

Format based on [Keep a Changelog](https://keepachangelog.com/).

## [0.1.0] - 2026-06-25

### Added

- Core framework: routing, controllers, middleware, HTTP kernel
- TaandView templating engine (`.taand` files)
- Session authentication, gates, policies, CSRF
- Validation with form requests and database rules
- Prisma ORM integration (SQLite default, PostgreSQL supported)
- Queue & jobs, mail, cache, events, logging
- CLI (`Taand`) with `make:*` generators
- Dev server with hot reload; production server with health check
- Test suite (routing, auth, security, validation, views, CLI, cache, queue, mail, events)
- GitHub Actions CI (test + build on Node.js 22 and 24)
- `create-taand` scaffolding (`npm create taand@latest`)
- Open-source docs: LICENSE, CONTRIBUTING, SECURITY, CHANGELOG

### Notes

- Early release (`0.1.0`) — APIs may change before `1.0.0`.
- Requires Node.js 22 or newer.
