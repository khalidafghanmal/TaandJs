# Logging

Structured, secure logging for TaandJs — Taand's `Log` facade equivalent. Every production app needs this to debug errors, audit actions, and monitor health.

## What is logging?

Logging writes timestamped records about what your app is doing — errors, warnings, info messages, and debug traces. Without it you are blind in production.

Taand logging is built for **security** and **power**:

- **Automatic redaction** — passwords, tokens, API keys, and secrets are never written to disk
- **Path-safe file storage** — log files cannot escape `storage/logs/`
- **Multiple channels** — console, single file, daily rotation, stacks
- **RFC 5424 levels** — `emergency` through `debug`
- **JSON lines** — file logs are machine-parseable
- **Request context** — IP, method, and path attached automatically per request

---

## Quick start

```js
import log from '../start/log.js';

log.info('Server started');
log.error('Database connection failed', { error: err });
log.debug('Cache miss', { key: 'users:1' });
```

### In a controller

```js
this.log().info('Order placed', { orderId: 42 });
this.log('daily').warning('Low stock', { sku: 'ABC-123' });
```

---

## Log levels

| Level | When to use |
|-------|-------------|
| `emergency` | System is unusable |
| `alert` | Immediate action required |
| `critical` | Critical failures |
| `error` | Runtime errors |
| `warning` | Unexpected but recoverable |
| `notice` | Normal but significant |
| `info` | General information |
| `debug` | Detailed debugging (dev only) |

Lower number = higher priority. A channel set to `info` ignores `debug`.

```js
log.info('User signed in', { userId: 1 });
log.warning('Rate limit approaching', { ip: '1.2.3.4' });
log.error('Payment gateway timeout', { error: err, orderId: 99 });
```

---

## Channels

Switch channels with `log.channel()`:

```js
log.channel('daily').info('Archived old records');
log.channel('stderr').error('Critical alert');
```

### Built-in channels

| Channel | Driver | Description |
|---------|--------|-------------|
| `stack` | stack | Default — daily file + stderr in dev, daily only in production |
| `single` | single | One file with size-based rotation (10 MB) |
| `daily` | daily | One file per day, auto-prune after 14 days |
| `stderr` | stderr | Human-readable output to terminal |
| `null` | null | Discard all output (testing) |

Configure in `config/logging.js`.

---

## Configuration

`config/logging.js`:

```js
export default {
  default: 'stack',
  level: 'debug',

  sanitize: ['password', 'authorization', 'cookie'],

  channels: {
    stack: {
      driver: 'stack',
      channels: ['daily', 'stderr'],
      level: 'debug',
    },
    daily: {
      driver: 'daily',
      path: 'storage/logs/taand.log',
      level: 'debug',
      days: 14,
    },
  },
};
```

### Environment variables

| Variable | Default | Description |
|----------|---------|-------------|
| `TAAND_LOG_LEVEL` | `debug` (local), `info` (production) | Minimum level to record |
| `TAAND_LOG_CHANNEL` | `stack` | Default channel name |
| `TAAND_LOG_DAYS` | `14` | Days to keep daily log files |

---

## Security

### Automatic redaction

Sensitive keys are replaced with `[REDACTED]` before writing:

- `password`, `password_confirmation`, `token`, `secret`
- `api_key`, `authorization`, `cookie`, `credit_card`
- Any key matching `pass`, `auth`, `key`, `secret`, `token`

```js
log.info('Login attempt', {
  email: 'user@example.com',
  password: 'hunter2',  // written as [REDACTED]
});
```

Add custom keys in `config/logging.js` → `sanitize`.

### Safe file paths

Log file paths must resolve inside `storage/logs/`. Path traversal (`../`) is blocked.

### File permissions

Log directories: `750`. Log files: `640`.

### Exception reporting

Unhandled exceptions are logged automatically (except validation errors). Passwords in exception context are redacted.

---

## File log format

Each line is JSON (easy to ship to Datadog, Loki, etc.):

```json
{"datetime":"2026-06-15T10:30:00.000Z","channel":"daily","level":"info","message":"Request completed","context":{"ip":"127.0.0.1","method":"GET","path":"/","status":200,"ms":12}}
```

Daily files: `storage/logs/taand-2026-06-15.log`

---

## Request logging

The `log` middleware (global stack) automatically:

1. Attaches `ip`, `method`, `path` to every log during a request
2. Writes `debug` on request start
3. Writes `info` with status and duration on completion
4. Clears context after the response

No extra setup required.

---

## Error objects

Pass errors in context — stack traces are captured and sanitized:

```js
try {
  await riskyOperation();
} catch (error) {
  log.error('Operation failed', { error });
}
```

---

## Production tips

```bash
TAAND_ENV=production
TAAND_LOG_LEVEL=info
TAAND_LOG_CHANNEL=stack
TAAND_LOG_DAYS=30
```

- Use `info` or `warning` in production — skip `debug` noise
- Use `daily` channel for rotation and retention
- Never log raw request bodies with credentials
- Monitor `storage/logs/` disk usage

---

## See also

- [Configuration](./config.md) — env variables
- [Middleware](./middleware.md) — global `log` middleware
- [Errors](./errors.md) — exception handling
