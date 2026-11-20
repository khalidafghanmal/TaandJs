# TaandJs Documentation

TaandJs is a JavaScript framework built for modern Node.js apps — built for **security**, **performance**, and **developer experience**.

## Quick start

```bash
cd Taand
cp .env.example .env
npm install
npm run db:migrate
npm run dev
```

Open `http://127.0.0.1:2977` (falls back to `1893` if busy).

**Production:** `npm run start` → `http://127.0.0.1:8000` · See [server.md](./server.md).

**Open-source checklist:** [1.md](./1.md) — CI, legal files, tests, create flow.



## Project structure

```
TaandJs/
├── engine/              # Framework engine
├── start/               # Boot facades (app, route, db…)
├── config/              # Configuration
├── src/                 # Actions, features, jobs, mail, policies
├── ui/                  # .taand templates
├── flow/                # HTTP flow (http.js)
├── web/                 # Public assets
├── records/seeds/       # Prisma seeders
├── schema/              # Schema & migrations
├── storage/             # Runtime (cache, logs, uploads, DB)
├── bin/                 # CLI commands
├── specs/               # Test suite
└── docs/                # Documentation
```
