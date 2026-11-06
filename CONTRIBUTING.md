# Contributing to TaandJs

Thank you for contributing!

## Getting started

```bash
cd TaandJs
cp .env.example .env
npm install
npm run db:migrate
npm test
```

## Pull requests

1. Fork the repo and create a branch from `main`.
2. Make focused changes — one feature or fix per PR.
3. Run `npm test` and `npm run build` before opening the PR.


## Code style

- Match existing patterns in `engine/` and `src/`.
- Use ES modules (`import` / `export`).
- Keep comments for non-obvious logic only.

## Reporting bugs

Open a GitHub issue with steps to reproduce, expected vs actual behavior, and your Node.js version.

## License

By contributing, you agree your contributions are licensed under the [MIT License](LICENSE).
