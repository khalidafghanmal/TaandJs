# TaandJs

A fast, secure, developer-friendly JavaScript framework for Node.js: routing, controllers, middleware, `.taand` views, Prisma ORM, auth, validation, queues, mail, cache, events and a `taand` CLI with `make:*` generators.

Requires **Node.js 22 or newer**.

## Quick start

```bash
cp .env.example .env
npm install            # also runs prisma generate
npm run db:migrate
npm run dev            # http://127.0.0.1:2977
```

Production:

```bash
npm run build
npm start              # http://127.0.0.1:8000
```

Tests: `npm test`

## Documentation

See [docs/README.md](./docs/README.md).

## License

[MIT](./LICENSE)
