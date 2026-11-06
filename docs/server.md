# Production Server

Run TaandJs in production with a secure, performant HTTP server — separate from the dev server with hot reload.

## Dev vs production

| | `npm run dev` | `npm run start` |
|---|---------------|-----------------|
| Server | `DevServer` | `ProductionServer` |
| Host | `127.0.0.1` | `0.0.0.0` (all interfaces) |
| Port | `2977` (+ fallback) | `8000` |
| Hot reload | Yes | No |
| Live reload SSE | Yes | No |
| Health check | No | `GET /up` |
| Graceful shutdown | Yes | Yes (drains connections) |
| APP_KEY check | No | **Required** |

---

## Quick start

```bash
# 1. Set production env
cp .env.example .env
# Set TAAND_APP_KEY, TAAND_ENV=production, TAAND_DEBUG=false

# 2. Migrate database
npm run db:migrate:prod   # production — use db:migrate locally only

# 3. Build & start
npm run build
npm run start
```

Open `http://127.0.0.1:8000` · Health: `http://127.0.0.1:8000/up`

The browser opens automatically when `TAAND_OPEN_BROWSER=true` (default in local, off in production).

---

## Build

Production runs from a **bundled** `dist/` folder (esbuild):

```bash
npm run build    # bundle server → dist/serve.js + copy app files
npm run start    # run dist/serve.js
```

`npm run start:raw` skips the bundle and runs `bin/serve.js` directly (development only).

---

## Commands

```bash
npm run build          # Production bundle → dist/
npm run start          # Run bundled production server
npm run start:raw      # Run unbundled bin/serve.js
npm run dev            # Dev server with hot reload
```

---

## Configuration

`settings/server.js` + `.env`:

| Variable | Default | Description |
|----------|---------|-------------|
| `TAAND_HOST` | `127.0.0.1` | Bind address (`0.0.0.0` = all interfaces, for Docker) |
| `TAAND_SERVER_PORT` | `8000` | Production port (separate from dev `TAAND_PORT`) |
| `TAAND_OPEN_BROWSER` | `true` (local) / `false` (production) | Open browser on start |
| `TAAND_SERVER_TIMEOUT` | `30000` | Per-request timeout (ms) |
| `TAAND_KEEP_ALIVE_TIMEOUT` | `65000` | HTTP keep-alive (ms) |
| `TAAND_HEADERS_TIMEOUT` | `66000` | Headers timeout (ms) |
| `TAAND_MAX_CONNECTIONS` | `1000` | Max concurrent connections |
| `TAAND_SHUTDOWN_TIMEOUT` | `30000` | Graceful shutdown wait (ms) |
| `TAAND_HEALTH_PATH` | `/up` | Health check endpoint |

### Production `.env` example

```bash
TAAND_ENV=production
TAAND_DEBUG=false
TAAND_APP_KEY=your-random-32-character-secret-key
TAAND_HOST=0.0.0.0
TAAND_SERVER_PORT=8000
QUEUE_CONNECTION=database
MAIL_MAILER=failover
TAAND_CACHE_STORE=file
```

---

## Health check

`GET /up` returns JSON (for load balancers, Docker, Kubernetes):

```json
{
  "status": "ok",
  "uptime": 3600
}
```

Does not hit the full app stack — fast and safe for probes.

---

## Security

| Feature | Description |
|---------|-------------|
| **APP_KEY required** | Server refuses to start with default key |
| **Path sanitization** | Blocks `..` and `\` traversal |
| **Max path length** | 2048 characters |
| **Request timeout** | Kills slow/hanging requests |
| **Graceful shutdown** | `SIGTERM` / `SIGINT` — finishes active requests |
| **503 on shutdown** | New requests rejected while stopping |
| **No dev dashboards** | `__Taand/*` routes only register when `TAAND_DEBUG=true` |
| **Error logging** | Failures logged via log system in production |

---

## Behind Nginx / reverse proxy

```nginx
server {
    listen 80;
    server_name example.com;

    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Enable `TrustProxies` middleware (already in config) so `req.ip()` returns the real client IP.

---

## Production process layout

Run three processes (e.g. with PM2, systemd, or Docker):

```bash
# Web server
npm run start

# Queue worker
npm run queue:work -- --connection=database

# Optional: second worker for emails queue
npm run queue:work -- --connection=database --queue=emails
```

---

## Docker example

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .
RUN npx prisma generate
EXPOSE 8000
CMD ["npm", "run", "start"]
```

```bash
docker run -p 8000:8000 --env-file .env your-app
```

---

## Graceful shutdown

On `SIGINT` or `SIGTERM`:

1. Stops accepting new connections
2. Returns `503` to in-flight new requests
3. Waits for active requests (up to `TAAND_SHUTDOWN_TIMEOUT`)
4. Disconnects Prisma
5. Flushes logs
6. Exits

---

## See also

- [production.md](./production.md) — full deploy checklist & migration commands
- [hot-reload.md](./hot-reload.md) — dev server only
- [config.md](./config.md) — environment variables
- [queue.md](./queue.md) — run workers alongside the server
