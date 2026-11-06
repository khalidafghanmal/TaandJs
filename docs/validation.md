# Validation

Every real application needs to validate user input before using it. Taand ships a powerful validation layer — Taand now has the same, with clean taand-style rule syntax.

## What is validation?

Validation checks that incoming data (forms, JSON bodies, query strings) meets your rules **before** you save to the database or run business logic. Without it, bad input causes bugs, security issues, and confusing errors.

Taand validates:

- Form fields (`application/x-www-form-urlencoded`)
- JSON bodies (`application/json`)
- Query strings and route parameters

When validation fails:

- **API requests** → `422` JSON with an `errors` object
- **Web requests** → redirect back with errors and old input flashed to the session

---

## Quick start

### In a controller

```js
import { Controller } from '../../engine/core/Controller.js';

export class UserController extends Controller {
  async store(req) {
    const data = await this.validate(req, {
      name: 'required|string|min:3|max:255',
      email: 'required|email|unique:user,email',
      password: 'required|min:8|confirmed',
    });

    // $data only contains validated fields
    await this.db().user.create({
      data: {
        name: data.name,
        email: data.email,
        password: data.password,
      },
    });

    return this.redirect('/users');
  }
}
```

### With the `validate` helper

```js
import validate from '../start/validate.js';

route.post('/users', async (req) => {
  const data = await validate(req, {
    name: 'required|string|min:3',
    email: 'required|email|unique:user,email',
  });

  return { created: true, user: data };
});
```

### Validate a plain object

```js
import { validator } from '../start/validate.js';

const data = await validator(
  { email: 'user@example.com', age: 25 },
  { email: 'required|email', age: 'required|integer|min:18' },
);
```

---

## Rule syntax

Rules are pipe-separated strings — same as Taand:

```js
{
  email: 'required|email',
  password: 'required|min:8|confirmed',
  role: 'required|in:admin,user,guest',
  website: 'nullable|url',
  code: 'required|regex:^[A-Z]{3}$',
}
```

### Available rules

| Rule | Description |
|------|-------------|
| `required` | Field must be present and not empty |
| `nullable` | If empty, skip all other rules |
| `string` | Must be a string |
| `email` | Valid email address |
| `min:n` | Minimum length (string) or value (number) |
| `max:n` | Maximum length (string) or value (number) |
| `numeric` | Must be a number |
| `integer` | Must be an integer |
| `boolean` | `true`, `false`, `1`, `0` |
| `in:a,b,c` | Value must be in the list |
| `not_in:a,b,c` | Value must not be in the list |
| `regex:pattern` | Must match the regex |
| `confirmed` | Must match `{field}_confirmation` |
| `same:other` | Must match another field |
| `different:other` | Must differ from another field |
| `array` | Must be an array |
| `url` | Valid `http://` or `https://` URL |
| `alpha` | Letters only |
| `alpha_num` | Letters and numbers only |
| `digits:n` | Exactly `n` digits |
| `date` | Valid date string |
| `unique` | Value must not exist in DB — see [Database rules](#database-rules-prisma) |
| `exists` | Value must exist in DB — see [Database rules](#database-rules-prisma) |

> **Note:** `validate()` and `this.validate()` are **async** when using `unique` or `exists` rules (they query Prisma).

### Database rules (Prisma)

Rules use your **Prisma model name** (camelCase delegate), not SQL table names:

| Rule | Example | Meaning |
|------|---------|---------|
| `unique` | `unique:user,email` | Email not already taken |
| `unique` (update) | `unique:user,email,5` | Unique except user id `5` |
| `unique` (custom id col) | `unique:user,email,5,id` | Ignore row where `id = 5` |
| `exists` | `exists:user,id` | User id must exist |
| `exists` | `exists:user,email` | Email must exist |

Aliases like `users` map to `user` automatically.

```js
await this.validate(req, {
  email: 'required|email|unique:user,email',
  user_id: 'required|integer|exists:user,id',
});

// Update — ignore current record
await this.validate(req, {
  email: `required|email|unique:user,email,${req.params.id}`,
});
```

### Custom callback rules

```js
this.validate(req, {
  username: (value) => value !== 'admin' || 'Username is reserved.',
});
```

---

## Custom messages

Pass a messages object as the third argument:

```js
this.validate(req, rules, {
  'email.required': 'Please enter your email.',
  'email.email': 'That does not look like a valid email.',
});
```

Or define defaults in `settings/validation.js`:

```js
export default {
  messages: {
    required: 'The :attribute field is required.',
    email: 'The :attribute must be a valid email address.',
  },
  attributes: {
    email: 'email address',
  },
};
```

Placeholders: `:attribute`, `:min`, `:max`, `:digits`, `:other`, `:values`.

---

## FormRequest class

For reusable validation logic, extend `FormRequest`:

```js
import { FormRequest } from '../../engine/validation/FormRequest.js';

export class StoreUserRequest extends FormRequest {
  rules() {
    return {
      name: 'required|string|min:3|max:255',
      email: 'required|email',
      password: 'required|min:8|confirmed',
    };
  }

  messages() {
    return {
      'email.required': 'Email is required.',
    };
  }
}
```

```js
// In controller
import { StoreUserRequest } from '../Requests/StoreUserRequest.js';

store(req) {
  const data = await new StoreUserRequest(this.app, req).validated();
  // ...
}
```

---

## API error response

When validation fails on an API route (`/api/*` or `Accept: application/json`):

```json
{
  "message": "The given data was invalid.",
  "errors": {
    "email": ["The email address must be a valid email address."],
    "password": ["The password must be at least 8 characters."]
  }
}
```

HTTP status: **422 Unprocessable Entity**.

---

## Web form errors

On HTML form submissions, Taand redirects back and flashes:

| Session key | Contents |
|-------------|----------|
| `errors` | `{ field: ['message'] }` |
| `old` | Previous input values |

Read them in controllers or pass to views:

```js
const errors = auth(req).flash('errors', {});
const old = auth(req).flash('old', {});
return this.view('users.create', { errors, old });
```

In templates, show field errors:

```html
<input name="email" value="{{ $old.email ?? '' }}">
@if ($errors.email)
  <p class="error">{{ $errors.email[0] }}</p>
@end
```

---

## Catching errors manually

```js
import { ValidationError } from '../../engine/validation/ValidationError.js';

try {
  const data = await this.validate(req, rules);
} catch (err) {
  if (err instanceof ValidationError) {
    console.log(err.errors);       // { email: ['...'] }
    console.log(err.first('email')); // first message for field
  }
  throw err;
}
```

---

## See also

- [Controllers](./controllers.md) — `this.validate()` on the base controller
- [Configuration](./config.md) — `settings/validation.js`
- [Database](./database.md) — Prisma models for `unique` / `exists`
- [Seeders](./seeders.md) — sample data for testing validation
- [Middleware](./middleware.md) — `web` group for session flash on redirect
