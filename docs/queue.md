# Queue & Jobs

Background job processing for TaandJs — Taand's `Queue` facade and more. Run mail, exports, and heavy work off the request thread with retries, timeouts, and a dev dashboard.

## What are queues?

**Queues** defer slow work to a background **worker** so HTTP responses stay fast. Instead of sending email during a request, you **dispatch a job** and return immediately.

```
Request → dispatch(SendWelcomeEmail) → 200 OK
Worker  → SendWelcomeEmail.handle()  → mail sent
```

**Jump to:** [Examples — basic to advanced](#examples--basic-to-advanced)

---

## Quick start

```js
import queue, { dispatch } from '../start/queue.js';
import { SendWelcomeEmail } from '../src/jobs/SendWelcomeEmail.js';

// Dispatch (runs immediately with sync driver)
await dispatch(new SendWelcomeEmail(app, { userId: 1 }));

// Or fluent API
await queue.dispatch(new SendWelcomeEmail(app, { userId: 1 })).onQueue('emails');
```

Start the worker (database/array driver):

```bash
npm run queue:work
```

---

## Examples — basic to advanced

### Level 1 — Dispatch a job (sync, instant)

Default `QUEUE_CONNECTION=sync` runs the job immediately — great for local dev.

```js
import { app } from '../start/app.js';
import dispatch from '../start/queue.js';
import { PingJob } from '../src/jobs/PingJob.js';

await app.bootstrap();
await dispatch(new PingJob(app, { message: 'hello' }));
```

---

### Level 2 — Create a job class

**`src/jobs/SendWelcomeEmail.js`:**

```js
import { Job } from '../../engine/queue/Job.js';
import { WelcomeMail } from '../Mail/WelcomeMail.js';

export class SendWelcomeEmail extends Job {
  queue = 'emails';
  tries = 3;
  timeout = 30;

  async handle() {
    const user = await this.app.make('db').user.findUnique({
      where: { id: this.userId },
    });
    if (!user) return;

    await this.app.make('mail').send(new WelcomeMail(this.app, user));
  }

  serialize() {
    return { userId: this.userId };
  }
}
```

**Dispatch:**

```js
await queue.dispatch(new SendWelcomeEmail(app, { userId: user.id }));
```

---

### Level 3 — From a controller (after register)

```js
export class AuthController extends Controller {
  async register(req) {
    const data = this.validate(req, { email: 'required|email', name: 'required', password: 'required|min:8' });
    const user = await this.db().user.create({ data });

    // Return fast — email sends in background
    await this.queue().dispatch(new SendWelcomeEmail(this.app, { userId: user.id }));

    return this.redirect('/dashboard');
  }
}
```

---

### Level 4 — Delayed jobs

Run 5 minutes later:

```js
await queue.dispatch(new SendReminder(app, { userId: 1 })).delay(300);
// or
await queue.later(300, new SendReminder(app, { userId: 1 }));
```

---

### Level 5 — Named queues & connections

```js
await queue
  .dispatch(new SendWelcomeEmail(app, { userId: 1 }))
  .onQueue('emails')
  .connection('database')
  .push();
```

| Queue | Use for |
|-------|---------|
| `default` | General work |
| `emails` | Mail jobs |
| `exports` | Heavy CSV/PDF exports |

---

### Level 6 — Batch dispatch

```js
await queue.batch([
  new SendWelcomeEmail(app, { userId: 1 }),
  new SendWelcomeEmail(app, { userId: 2 }),
], { queue: 'emails', connection: 'database' });
```

---

### Level 7 — Run the worker

**Database queue (production):**

```bash
# .env
QUEUE_CONNECTION=database

# Migrate jobs tables
npm run db:migrate

# Run worker
npm run queue:work

# Process one job and exit
npm run queue:work -- --once

# Specific queue
npm run queue:work -- --queue=emails --connection=database
```

**Array queue (dev):**

```bash
QUEUE_CONNECTION=array npm run queue:work -- --once
```

---

### Level 8 — Retries, timeout, backoff

On the job class:

```js
export class ProcessPayment extends Job {
  queue = 'payments';
  tries = 5;           // max attempts
  timeout = 120;       // seconds per attempt
  backoff = [10, 30, 60, 120, 300]; // retry delays

  async handle() {
    await chargeCustomer(this.orderId);
  }

  async failed(error) {
    this.app.make('log').error('Payment job failed permanently', { error, orderId: this.orderId });
  }
}
```

---

### Level 9 — Failed jobs & retry

Failed jobs are stored in `failed_jobs` table. Retry from CLI dashboard or code:

```bash
npm run queue:failed
```

```js
await app.make('queue.failed').retry(uuid, app.make('queue'));
```

**Dev dashboard:** http://127.0.0.1:2977/__Taand/queue

---

### Level 10 — Queue + Mail together

```js
// Don't block the request with SMTP
await this.queue().dispatch(new SendWelcomeEmail(this.app, { userId: user.id }));

// Worker runs SendWelcomeEmail.handle() → mail.send(WelcomeMail)
```

---

## Job class reference

```js
import { Job } from '../../engine/queue/Job.js';

export class MyJob extends Job {
  queue = 'default';     // queue name
  tries = 3;             // max attempts
  timeout = 60;          // seconds
  backoff = [10, 30, 60]; // retry delays

  async handle() {
    // Do the work
  }

  async failed(error) {
    // Called when all retries exhausted
  }

  serialize() {
    return { /* data to persist */ };
  }
}
```

---

## Drivers

| Connection | Driver | Use case |
|------------|--------|----------|
| `sync` | Immediate | Local dev (default) |
| `database` | Prisma `jobs` table | Production |
| `array` | In-memory | Tests + dev worker |
| `null` | Discard | Testing |

---

## Configuration

`config/queue.js` + `.env`:

| Variable | Default | Description |
|----------|---------|-------------|
| `QUEUE_CONNECTION` | `sync` (dev), `database` (prod) | Default connection |
| `QUEUE_RETRY_AFTER` | `90` | Release stale reserved jobs (seconds) |

### Production

```bash
TAAND_ENV=production
QUEUE_CONNECTION=database
npm run db:migrate
npm run queue:work
```

---

## Security

| Protection | Description |
|------------|-------------|
| **Job whitelist** | Classes only from `src/jobs/` |
| **PascalCase only** | Blocks invalid class names |
| **JSON payloads** | No `eval`, no code injection |
| **Max payload size** | 256 KB limit |
| **Job timeout** | Kills runaway jobs |
| **Dashboard gated** | Local + debug only |

---

## Events

| Event | When |
|-------|------|
| `job.processing` | Before handle() |
| `job.processed` | Success |
| `job.retrying` | Failed, will retry |
| `job.failed` | All retries exhausted |

```js
events.listen('job.failed', ({ job, error }) => {
  log.error('Job failed', { job, error });
});
```

---

## Beyond Taand

| Feature | Description |
|---------|-------------|
| **Dev dashboard** | `/__Taand/queue` — pending & failed jobs |
| **Array driver** | Test workers without database |
| **Batch dispatch** | Push many jobs at once |
| **Native worker CLI** | `npm run queue:work` |
| **Retry from UI** | One-click retry on dashboard |
| **Job timeout** | Built-in per job |
| **Zero extra deps** | Uses Prisma you already have |

---

## API reference

| Method | Description |
|--------|-------------|
| `dispatch(job)` | Start fluent dispatch |
| `queue.dispatch(job)` | Same with connection proxy |
| `queue.later(seconds, job)` | Delayed dispatch |
| `queue.batch(jobs, opts)` | Dispatch many jobs |
| `.onQueue(name)` | Set queue name |
| `.delay(seconds)` | Delay before run |
| `.connection(name)` | Set connection |
| `.push()` | Push to queue |

---

## See also

- [Mail](./mail.md) — queue welcome emails
- [Events](./events.md) — job lifecycle events
- [Database](./database.md) — Prisma migrations
- [Controllers](./controllers.md) — `this.queue()` helper
