# Cache

High-performance caching for TaandJs — Taand's `Cache` facade and more. Multiple stores, tags, locks, stale-while-revalidate, built-in stats, and a dev dashboard UI.

## What is caching?

**Caching** stores expensive results (database queries, API calls, computed data) so the next request is instant. Without it, every request hits the database.

Taand cache goes beyond Taand basics:

| Feature | Taand | Taand |
|---------|---------|-------|
| get / put / remember | ✅ | ✅ |
| Multiple stores | ✅ | ✅ memory, file, null |
| Tags | Redis only | ✅ all drivers |
| Locks | ✅ | ✅ |
| Hit/miss stats | ❌ | ✅ built-in |
| Stale-while-revalidate | ❌ | ✅ `flexible()` |
| Request memo | ❌ | ✅ `memo()` |
| Dev dashboard UI | ❌ | ✅ `/__Taand/cache` |
| Safe JSON only | — | ✅ no unsafe unserialize |

---

## Quick start

```js
import cache from '../start/cache.js';

// Store for 1 hour (3600 seconds)
await cache.put('users:all', users, 3600);

// Retrieve
const users = await cache.get('users:all');

// Remember — compute only on miss
const posts = await cache.remember('posts:recent', 300, async () => {
  return db.post.findMany({ take: 10 });
});
```

### In a controller

```js
const data = await this.cache().remember('dashboard.stats', 60, async () => {
  return this.buildStats();
});
```

---

## Dev dashboard UI

When `TAAND_DEBUG=true`, open:

**http://127.0.0.1:2977/__Taand/cache**

The dashboard shows:

- Hit rate, hits, misses, writes
- Entry count and storage size
- Cached keys per store
- Flush store / flush all buttons

Security: **local requests only** (`127.0.0.1`) and **debug mode only**.

---

## Stores & drivers

| Store | Driver | Best for |
|-------|--------|----------|
| `memory` | In-memory LRU | Local dev, hottest data (default) |
| `file` | Disk files | Production persistence |
| `null` | No-op | Testing |

```js
await cache.store('file').put('key', value, 3600);
await cache.driver('memory').get('key');
```

### Configuration

`settings/platform.js` → `memory` (registry key `cache`):

```js
memory: {
  default: 'memory',
  prefix: '',
  stores: {
    memory: { driver: 'memory', maxEntries: 1000, maxBytes: 52428800 },
    file: { driver: 'file', path: 'storage/cache/data' },
    redis: { driver: 'redis', connection: 'cache' },
    null: { driver: 'null' },
  },
},
```

### Environment variables

| Variable | Default | Description |
|----------|---------|-------------|
| `TAAND_CACHE_STORE` | `memory` (local), `file` (production) | Default store |
| `TAAND_CACHE_PREFIX` | `` | Key prefix for all stores |
| `TAAND_CACHE_MAX_ENTRIES` | `1000` | Memory driver LRU limit |
| `TAAND_CACHE_MAX_BYTES` | `52428800` (50 MB) | Memory driver size limit |

---

## API reference

### Basic operations

```js
await cache.put('key', value, 3600);     // TTL in seconds
await cache.forever('key', value);       // no expiry
const v = await cache.get('key');
const v = await cache.get('key', 'default');
await cache.has('key');
await cache.missing('key');
await cache.forget('key');
await cache.flush();
```

### remember

```js
const value = await cache.remember('key', 60, async () => {
  return expensiveOperation();
});

const value = await cache.rememberForever('key', async () => {
  return expensiveOperation();
});
```

### pull — get and delete

```js
const value = await cache.pull('key');
```

### many / putMany

```js
const values = await cache.many(['a', 'b', 'c']);
await cache.putMany({ a: 1, b: 2 }, 3600);
```

### add — only if missing

```js
const added = await cache.add('lock-key', true, 10);
```

### increment / decrement

```js
await cache.put('views', 0, 3600);
await cache.increment('views');
await cache.increment('views', 5);
await cache.decrement('views');
```

---

## Tags — invalidate groups

```js
const tagged = cache.tags('posts', 'homepage');

await tagged.put('list', posts, 3600);
await tagged.put('featured', featured, 3600);

// Invalidate all keys tagged "posts"
await cache.tags('posts').flush();
```

---

## Locks — prevent race conditions

```js
const lock = cache.lock('process-invoice', 10);

if (await lock.get()) {
  try {
    await processInvoice();
  } finally {
    await lock.release();
  }
}

// Block up to 5 seconds waiting
if (await lock.get(5)) { ... }
```

---

## flexible — stale-while-revalidate

Serve stale data instantly while refreshing in the background. Great for APIs and dashboards.

```js
// Fresh for 60s, stale-but-valid for up to 300s
const data = await cache.flexible('analytics', [60, 300], async () => {
  return await fetchAnalytics();
});
```

---

## memo — single-request cache

Avoid duplicate work within one HTTP request:

```js
const config = this.cache().memo('app.config', () => buildConfig());
```

---

## Stats

```js
const stats = cache.stats();
// { hits: 42, misses: 8, writes: 10, hitRate: 84.0 }

const overview = await app.make('cache').overview();
```

### Cache events

Dispatched automatically when the event system is loaded:

| Event | When |
|-------|------|
| `cache.hit` | Key found |
| `cache.miss` | Key not found |
| `cache.write` | Key stored |
| `cache.forget` | Key deleted |
| `cache.flush` | Store cleared |

```js
// src/events.js
events.listen('cache.miss', (payload) => {
  log.debug('Cache miss', payload);
});
```

---

## Security

| Protection | Description |
|------------|-------------|
| **JSON only** | No `eval`, no PHP-style unserialize attacks |
| **Path safety** | File cache cannot escape `storage/cache/` |
| **File permissions** | Directories `750`, files `640` |
| **Atomic writes** | Temp file + rename prevents corruption |
| **Dashboard gated** | Local + debug only |
| **Lock ownership** | Only lock owner can release |

---

## Performance tips

```bash
# Local dev — fastest
TAAND_CACHE_STORE=memory

# Production — persistent
TAAND_ENV=production
TAAND_CACHE_STORE=file
```

- Use `remember()` for database queries
- Use `tags()` so you can invalidate related keys together
- Use `flexible()` for data that can be briefly stale
- Use `memo()` for per-request deduplication
- Monitor hit rate in the dev dashboard

---

## See also

- [Events](./events.md) — cache hit/miss events
- [Configuration](./config.md) — environment variables
- [Controllers](./controllers.md) — `this.cache()` helper
