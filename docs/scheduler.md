# Task scheduler

taand-style **cron scheduling** — define tasks in `src/schedule.js`, run via system cron.

---

## Quick start

**1. Define tasks** — `src/schedule.js`:

```js
export default function defineSchedule(schedule, app) {
  schedule.command('cache:clear').daily().name('Clear cache');

  schedule.call(async () => {
    app.make('log').info('Heartbeat');
  }).everyFiveMinutes().withoutOverlapping();
}
```

**2. Add cron entry** (every minute):

```cron
* * * * * cd /path/to/app && node bin/taand.js schedule:run >> /dev/null 2>&1
```

**3. List tasks:**

```bash
npm run Taand -- schedule:list
```

---

## Schedule API

| Method | Cron | Example |
|--------|------|---------|
| `everyMinute()` | `* * * * *` | Health checks |
| `everyFiveMinutes()` | `*/5 * * * *` | Sync jobs |
| `hourly()` | `0 * * * *` | Reports |
| `daily()` | `0 0 * * *` | Cleanup |
| `dailyAt('14:30')` | `30 14 * * *` | Afternoon job |
| `weekly()` | `0 0 * * 0` | Weekly digest |
| `cron('0 */6 * * *')` | Custom | Every 6 hours |

### Chaining

```js
schedule.command('queue:work --once')
  .everyMinute()
  .withoutOverlapping()
  .name('Process one queue job');
```

---

## CLI

| Command | Purpose |
|---------|---------|
| `Taand schedule:list` | Show all registered tasks |
| `Taand schedule:run` | Run due tasks (call from cron) |

---

## vs Taand

| Taand | Taand |
|---------|-------|
| `src/Console/Kernel.php` | `src/schedule.js` |
| `Taand schedule:run` | `Taand schedule:run` |
| `Taand schedule:list` | `Taand schedule:list` |

See also: [queue.md](./queue.md), [production.md](./production.md).
