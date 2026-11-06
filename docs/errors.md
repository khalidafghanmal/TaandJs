# Error pages

Taand renders styled HTML error pages for web requests. API routes (`/api/*`) and JSON clients still receive JSON responses.

## Included pages

| Code | When |
|------|------|
| **400** | Malformed or unsafe URL |
| **401** | Not signed in |
| **403** | Wrong role or permission |
| **404** | Route not found |
| **405** | Wrong HTTP method |
| **413** | Request body over `server.maxBodySize` (10 MB default) |
| **419** | CSRF token mismatch / expired page |
| **429** | Rate limit exceeded |
| **500** | Unhandled server error (production) |
| **503** | Server shutting down |

## Customize messages

Edit `config/errors.js`:

```js
export default {
  pages: {
    404: {
      title: 'Page Not Found',
      message: 'The page you are looking for does not exist.',
    },
  },
};
```

## Customize the template

View file: `ui/errors/error.taand`

Variables available:

| Variable | Description |
|----------|-------------|
| `$code` | HTTP status (404) |
| `$title` | Short title |
| `$message` | User-facing explanation |
| `$hint` | Optional extra tip (from `config/errors.js`) |

## Throw errors in controllers

```js
import { HttpError } from '../../engine/http/HttpError.js';

throw HttpError.notFound('Post not found');
throw HttpError.forbidden('You cannot edit this post');
```

## Debug mode

When `TAAND_DEBUG=true`, **500** errors show a stack trace instead of the error page (for development only).

## API responses

```json
{ "message": "Page Not Found", "status": 404 }
```
