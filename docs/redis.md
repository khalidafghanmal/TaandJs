# Redis — cache, sessions, queue, rate limiting

TaandJs supports **Redis** for production multi-server deployments. When `REDIS_URL` is set, cache, queue, and sessions automatically prefer Redis drivers.

---

## Quick start

```bash
npm run docker:up          # Postgres + Redis
# .env
REDIS_URL=redis://127.0.0.1:6379
TAAND_CACHE_STORE=redis
QUEUE_CONNECTION=redis
SESSION_DRIVER=redis
```

---

## What Redis powers

| Feature | Config | Env |
|---------|--------|-----|
| Cache | `config/cache.js` → `stores.redis` | `TAAND_CACHE_STORE=redis` |
| Queue | `config/queue.js` → `connections.redis` | `QUEUE_CONNECTION=redis` |
| Sessions | `config/auth.js` → `session.driver` | `SESSION_DRIVER=redis` |
| Rate limits | Uses cache store | Automatic with redis cache |

---

## Configuration

`config/redis.js`:

```js
connections: {
  default: { url: 'redis://127.0.0.1:6379', prefix: 'Taand:' },
  cache:   { url: '...', prefix: 'Taand:cache:' },
  session: { url: '...', prefix: 'Taand:session:' },
  queue:   { url: '...', prefix: 'Taand:queue:' },
}
```

### Environment

```env
REDIS_URL=redis://127.0.0.1:6379
REDIS_PREFIX=Taand:
TAAND_CACHE_STORE=redis
QUEUE_CONNECTION=redis
SESSION_DRIVER=redis
```

---

## Production checklist

1. Run Redis (managed: Upstash, ElastiCache, or Docker)
2. Set `REDIS_URL` on all app instances
3. Set `SESSION_DRIVER=redis` for shared sessions
4. Set `QUEUE_CONNECTION=redis` + run `npm run queue:work`
5. Set `TAAND_CACHE_STORE=redis` for shared cache + rate limits

---

## vs Taand

| Taand | Taand |
|---------|-------|
| `CACHE_DRIVER=redis` | `TAAND_CACHE_STORE=redis` |
| `SESSION_DRIVER=redis` | `SESSION_DRIVER=redis` |
| `QUEUE_CONNECTION=redis` | `QUEUE_CONNECTION=redis` |
| Horizon | `npm run queue:work` |

See also: [docker.md](./docker.md), [cache.md](./cache.md), [queue.md](./queue.md).
