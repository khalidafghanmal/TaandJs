# Events & Listeners

Decouple your application with Taand's event system — Taand's `Event` facade equivalent. Fire events, register listeners, and keep controllers thin.

## What are events?

**Events** signal that something happened (`user.registered`, `order.placed`). **Listeners** react to those signals (send email, update stats, write logs) without the controller knowing about them.

```
Controller → event('user.registered', user) → [SendWelcomeEmail, LogSignup, SyncCRM]
```

Benefits: cleaner code, easier testing, and a foundation for mail and queues later.

---

## Quick start

### Fire an event

```js
import event from '../start/event.js';

// String event + payload
await event('user.registered', { id: 1, email: 'user@example.com' });

// In a controller
await this.event('order.placed', order);
```

### Register a listener

```js
// src/events.js
import { SendWelcomeEmail } from './Listeners/SendWelcomeEmail.js';

export default async function registerEvents(events) {
  events.listen('user.registered', SendWelcomeEmail);
}
```

### Create a listener

```js
// src/listeners/SendWelcomeEmail.js
import { Listener } from '../../engine/events/Listener.js';

export class SendWelcomeEmail extends Listener {
  constructor(app) {
    super();
    this.app = app;
  }

  async handle(event) {
    this.app.make('log').info('Welcome email queued', { userId: event.id });
  }
}
```

---

## Typed event classes

Extend `Event` for structured domain events:

```js
// src/events/UserRegistered.js
import { Event } from '../../engine/events/Event.js';

export class UserRegistered extends Event {
  constructor(user) {
    super();
    this.user = user;
  }
}
```

```js
import { UserRegistered } from '../src/events/UserRegistered.js';

await event(new UserRegistered(user));
```

Listeners receive the event object:

```js
async handle(event) {
  console.log(event.user.email);
}
```

---

## Registration options

### Inline function

```js
events.listen('user.registered', (user) => {
  console.log('New user:', user.id);
});
```

### Class listener (imported)

```js
events.listen('user.registered', SendWelcomeEmail);
```

### String syntax (lazy load from `src/listeners/`)

```js
events.listen('user.registered', 'SendWelcomeEmail@handle');
```

Loads `src/listeners/SendWelcomeEmail.js` on first dispatch.

### Array syntax

```js
events.listen('user.registered', [SendWelcomeEmail, 'handle']);
```

### Priority

Higher runs first (default `0`):

```js
events.listen('order.placed', AuditLog, { priority: 100 });
events.listen('order.placed', SendReceipt, { priority: 50 });
```

### Run async (non-blocking)

Listener runs after the response via `setImmediate` — use for slow side effects:

```js
events.listen('user.registered', SendWelcomeEmail, { async: true });
```

### Run once

Auto-removed after first fire:

```js
events.listen('app.booted', WarmCache, { once: true });
```

### Unsubscribe

```js
const off = events.listen('user.registered', handler);
off(); // remove listener
```

---

## Wildcard listeners

Listen to many events with patterns:

```js
// All user.* events
events.listen('user.*', (eventName, payload) => {
  log.debug('User event', { eventName, userId: payload.id });
});

// Every event
events.listen('*', (eventName, payload) => {
  log.debug('Event fired', { eventName });
});
```

---

## Event subscribers

Group related listeners in one class:

```js
// src/listeners/UserEventSubscriber.js
export class UserEventSubscriber {
  constructor(app) {
    this.app = app;
  }

  subscribe(events) {
    events.listen('user.registered', [this, 'onRegistered']);
    events.listen('user.logout', [this, 'onLogout']);
  }

  onRegistered(user) {
    this.app.make('log').info('User registered', { id: user.id });
  }

  onLogout(user) {
    this.app.make('log').info('User logged out', { id: user?.id });
  }
}
```

```js
// src/events.js
import { UserEventSubscriber } from './Listeners/UserEventSubscriber.js';

export default async function registerEvents(events) {
  await events.subscribe(UserEventSubscriber);
}
```

---

## `until` — first result wins

Stop at the first listener that returns a non-null value:

```js
import { events } from '../start/event.js';

const token = await events.until('auth.attempt', credentials);
// → first listener returning a value wins
```

---

## Halt propagation

Return `false` from a listener to stop remaining listeners:

```js
events.listen('payment.process', (order) => {
  if (order.fraudulent) return false; // stop chain
});
```

Or call `event.halt()` on an Event class instance:

```js
export class OrderPlaced extends Event {}
// in listener:
if (invalid) event.halt();
```

---

## Security

| Protection | Description |
|------------|-------------|
| **Listener class whitelist** | String listeners only load from `src/listeners/` |
| **Class name validation** | Must match `PascalCase` — blocks path traversal |
| **Method whitelist** | Only `handle`, `listen`, `__invoke`, or public camelCase methods |
| **Blocked methods** | `constructor`, `_private`, `__proto__` cannot be invoked |
| **Max listeners** | Default 100 per event — prevents listener DoS |
| **Error isolation** | Listener failures are logged, not thrown (unless `stopOnFailure`) |

---

## Configuration

`settings/platform.js` → `dispatch` (registry key `events`):

```js
dispatch: {
  stopOnFailure: false,  // throw if a listener fails
  maxListeners: 100,     // per event
},
```

Environment variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `TAAND_EVENT_MAX_LISTENERS` | `100` | Max listeners per event |
| `TAAND_EVENT_STOP_ON_FAILURE` | `false` | Throw on listener error |

---

## Error handling

By default, a failing listener is **logged** and other listeners still run:

```js
// Logged automatically:
// Event listener failed { event: 'user.registered', error: ... }
```

Set `TAAND_EVENT_STOP_ON_FAILURE=true` to halt on first error.

---

## API reference

| Method | Description |
|--------|-------------|
| `event(name, payload)` | Dispatch event, await all listeners |
| `events.listen(event, listener, opts?)` | Register listener |
| `events.dispatch(event, payload?)` | Same as `event()` |
| `events.until(event, payload?)` | First non-null result |
| `events.subscribe(SubscriberClass)` | Register subscriber |
| `events.hasListeners(event)` | Check if listeners exist |
| `events.forget(event)` | Remove all listeners |

---

## See also

- [Logging](./logging.md) — listener errors are logged automatically
- [Controllers](./controllers.md) — `this.event()` in controllers
- [Core](./core.md) — service container
