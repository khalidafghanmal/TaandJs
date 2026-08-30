# Controllers

Controllers hold your route logic — like Taand. Routes stay thin; controllers return views, redirects, or JSON.

## Route → Controller

```js
// flow/http.js
import route from '../start/route.js';

route.get('/', 'HomeController@index');
```

## Create a controller

```js
// src/actions/HomeController.js
import { Controller } from '../../engine/core/Controller.js';

export class HomeController extends Controller {
  index() {
    return this.view('main');
  }
}
```

## Return types

| Return | Result |
|--------|--------|
| `this.view('main')` | HTML page (no data) |
| `this.view('main', { title: 'Hi' })` | HTML with data |
| `this.redirect('/dashboard')` | 302 redirect |
| `{ status: 'ok' }` | JSON response |
| `'Hello'` | HTML string |

See [views.md](./views.md) for how data flows into layouts and templates.

## Request in controllers

Controller methods receive the `Request` as their first argument — same object as closure handlers. Use `req.input()`, `req.json()`, `req.params`, and `req.isMethod()` for POST/PUT/PATCH bodies and route parameters. See [routing.md](./routing.md).

## Validation

Validate input before saving or processing (use `await` — DB rules are async):

```js
const data = await this.validate(req, {
  email: 'required|email|unique:user,email',
  password: 'required|min:8|confirmed',
});
```

Full guide: [validation.md](./validation.md).

## Pagination & API resources

Paginate Prisma results and shape JSON for APIs:

```js
import { UserResource } from '../Resources/UserResource.js';

async index(req) {
  const page = await this.paginate(this.db().user, {
    page: req.input('page', 1),
    path: req.path,
  });
  return UserResource.paginate(page);
}
```

See [pagination.md](./pagination.md) and [api-resources.md](./api-resources.md).

## Logging

```js
this.log().info('User created', { userId: 1 });
this.log().error('Save failed', { error: err });
```

Full guide: [logging.md](./logging.md).

## Events

```js
await this.event('user.registered', user);
```

Full guide: [events.md](./events.md).

## Cache

```js
await this.cache().remember('stats', 60, () => this.buildStats());
```

Dashboard: `http://127.0.0.1:2977/__Taand/cache` (debug + local only).

Full guide: [cache.md](./cache.md).

## Mail

```js
await this.mail().to(user.email).send(new WelcomeMail(this.app, user));
```

Dashboard: `http://127.0.0.1:2977/__Taand/mail` (debug + local only).

Full guide: [mail.md](./mail.md).

## Queue

```js
await this.queue().dispatch(new SendWelcomeEmail(this.app, { userId: user.id }));
```

Worker: `npm run queue:work` · Dashboard: `http://127.0.0.1:2977/__Taand/queue`

Full guide: [queue.md](./queue.md).

## Database (Prisma)

```js
const users = await this.db().user.findMany();
await this.db().user.create({ data: { name, email, password, role: 'user' } });
```

Or import `db` from `start/db.js`. Full guide: [database.md](./database.md).

## Assets & uploads

```js
// Public static file URL (web/images/logo.png)
this.asset('images/logo.png');

// User upload URL (storage/uploads/uploads/...)
this.storage('uploads/abc.jpg');

// Handle file upload
const file = await this.upload(req, 'photo', { type: 'image', folder: 'uploads' });
// → { path, url, mime, size }
```

In views: `{{ asset('images/logo.png') }}` and `{{ storage($photo) }}`.  
Full guide: [assets.md](./assets.md).

## Redirect (secure)

Only relative paths allowed — blocks open redirects:

```js
return this.redirect('/dashboard');
return this.redirect('/users', 301);
```

## Controller syntax

```js
// String (recommended)
route.get('/', 'HomeController@index');

// Class reference
import { HomeController } from '../src/actions/HomeController.js';
route.get('/', [HomeController, 'index']);
```

## Security

| Rule | Detail |
|------|--------|
| Controller path | Only `src/actions/*.js` |
| Name validation | `HomeController` format only |
| Method validation | Public methods; no `_private`, no `constructor` |
| Redirects | Relative `/path` only |

## Performance

| Feature | Benefit |
|---------|---------|
| Handler cache | Controller action compiled once per process |
| Instance reuse | One controller instance per class (singleton) |
| Hot reload | Controller cache flushed on file save in dev |
