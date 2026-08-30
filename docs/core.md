# Core

The TaandJs core mirrors Taand's application container and HTTP kernel.

## Application

The `Application` class is the framework entry point. It manages:

- **IoC Container** — service binding and resolution
- **Bootstrap** — env, config, providers, routes
- **Request handling** — delegates to the HTTP kernel

```js
// start/app.js
import { Application } from '../engine/core/Application.js';

export const app = Application.configure({ basePath })
  .withRouting('flow/http.js')
  .withProviders(AppServiceProvider, ViewServiceProvider);
```

## Container

Bind and resolve services:

```js
app.bind('mailer', () => new Mailer());
app.singleton('db', () => new Database());
const db = app.make('db');
```

## HTTP Kernel

Every request flows through:

```
Request → Global Middleware → Router → Route Middleware → Handler → Response
```

## Service providers

Register framework features in providers:

```js
import { ServiceProvider } from '../engine/core/ServiceProvider.js';

export class MyServiceProvider extends ServiceProvider {
  register() {
    this.app.singleton('myService', () => new MyService());
  }

  boot() {
    // Run after all providers registered
  }
}
```

## Exception handling

Uncaught errors are handled by `ExceptionHandler`:

- **Debug on** — detailed error page
- **Debug off** — generic 500 response (no leak)

Set `TAAND_DEBUG=false` in `.env` for production.
