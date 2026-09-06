# TaandJs — Production features

When `REDIS_URL` is set, Taand automatically uses Redis for cache, queue, and sessions (multi-server ready).

## New in this release

| Feature | Docs |
|---------|------|
| **Redis** — cache, sessions, queue, rate limits | [redis.md](./redis.md) |
| **S3 storage** — cloud uploads | [storage.md](./storage.md) |
| **Scheduler** — cron tasks | [scheduler.md](./scheduler.md) |
| **API tokens** — Sanctum-style PAT in kernel | [auth.md](./auth.md) |
| **create-taand** — `npm create taand@latest` | [1.md](./1.md) |

## Production env template

```env
TAAND_ENV=production
TAAND_DEBUG=false
TAAND_APP_KEY=your-64-char-secret

DATABASE_URL=postgresql://...
REDIS_URL=redis://127.0.0.1:6379
TAAND_CACHE_STORE=redis
QUEUE_CONNECTION=redis
SESSION_DRIVER=redis

FILESYSTEM_DISK=s3
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_BUCKET=
AWS_DEFAULT_REGION=us-east-1
```

## Cron (scheduler)

```cron
* * * * * cd /app && node bin/taand.js schedule:run
* * * * * cd /app && npm run queue:work -- --once
```
