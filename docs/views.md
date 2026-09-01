# Taand Markup

**Taand Markup** is the `.taand` templating engine in TaandJs — same ideas as Taand Blade, with **easier syntax**.

| Principle | Detail |
|-----------|--------|
| Easy | One `@end` closes `@section`, `@if`, `@each` |
| Safe | `{{ }}` auto-escapes HTML |
| Fast | Compiled once, cached to disk |
| Reusable | Layouts, sections, partials |

---

## Table of contents

1. [File structure](#file-structure)
2. [Rendering views](#rendering-views)
3. [How data works](#how-data-works)
4. [Syntax cheat sheet](#syntax-cheat-sheet)
5. [Standalone pages](#standalone-pages)
6. [Layouts & sections](#layouts--sections)
7. [Partials](#partials)
8. [Conditionals](#conditionals)
9. [Loops](#loops)
10. [Output & variables](#output--variables)
11. [Blade comparison](#blade-comparison)
12. [Security](#security)
13. [Performance](#performance)
14. [Live reload](#live-reload)
15. [Troubleshooting](#troubleshooting)
16. [Project files](#project-files)

---

## File structure

```
ui/
└── main.taand              # Default welcome page (standalone)
```

Add your own layouts, partials, and pages as needed — see examples below.

**Naming:** dot notation maps to folders.

| View name | File path |
|-----------|-----------|
| `main` | `ui/main.taand` |
| `layouts.app` | `ui/layouts/app.taand` |
| `partials.nav` | `ui/partials/nav.taand` |
| `posts.show` | `ui/posts/show.taand` |

**Compiled cache:** `storage/view-cache/` (auto-generated, do not edit).

---

## Rendering views

### From a controller (recommended)

```js
// src/actions/HomeController.js
import { Controller } from '../../engine/core/Controller.js';

export class HomeController extends Controller {
  index() {
    return this.view('main');           // no data
  }
}
```

```js
// With data (pass() strips secrets before the template sees them)
import { pass } from '../start/helpers.js';

return this.view('dashboard.index', pass({
  title: 'Dashboard',
  user: { name: 'Khalid', role: 'admin' },
}));
```

### From a route (closure)

```js
// flow/http.js
import route from '../start/route.js';
import view from '../start/view.js';   // required!

route.get('/hello', () => {
  return view('main');
});
```

### Register route + controller

```js
// flow/http.js
import route from '../start/route.js';

route.get('/', 'HomeController@index');
```

Open: `http://127.0.0.1:2977`

---

## How data works

Data is a plain JavaScript object passed as the **second argument** to `view()`.

```js
return this.view('pages.about', {
  title: 'My Page',
  heading: 'Hello',
  count: 5,
  users: [{ name: 'Ada' }],
});
```

In templates, use `$` prefix:

```html
{{ $title }}
{{ $heading }}
{{ $user.name }}
```

### Layout + child share the same data

When a child uses `@layout`, **both** the child and layout receive the **same data object**.

**Layout** (`layouts/app.taand`):
```html
<title>{{ $title }}</title>
<body>
  @show content
</body>
```

**Child** (`ui/about.taand`):
```html
@layout layouts.app

@section content
  <h1>{{ $heading }}</h1>
@end
```

- `{{ $title }}` in layout ← from `view(..., { title: '...' })`
- `{{ $heading }}` in child ← from same object
- If you omit `title`, layout `<title>` will be empty

### Standalone views (no layout)

`main.taand` has **no** `@layout` and **no** `{{ $variables }}` — all HTML is static inside the file. No data required:

```js
return this.view('main');
```

---

## Syntax cheat sheet

| Write | Purpose |
|-------|---------|
| `@layout layouts.app` | Use a layout |
| `@section content` … `@end` | Define a content block |
| `@show content` | Print block in layout |
| `@include partials.badge` | Include a partial |
| `@include partials.badge, { label: $status }` | Include with extra data |
| `@if $x` … `@end` | Conditional |
| `@elseif $y` | Else-if |
| `@else` | Else |
| `@each user in $users` … `@end` | Loop |
| `@each key, item in $items` … `@end` | Loop with key |
| `{{ $name }}` | Safe escaped output |
| `{! $html !}` | Raw output (trusted only) |
| `{{ asset('images/logo.png') }}` | Public asset URL |
| `{{ storage($photo) }}` | Uploaded file URL |

**Rule:** every `@section`, `@if`, and `@each` must end with `@end`.

---

## Standalone pages

Use when the page is self-contained (no shared layout).

**`ui/main.taand`**
```html
<!DOCTYPE html>
<html>
<head><title>Taand</title></head>
<body>
  <h1>Welcome to Taand 1</h1>
</body>
</html>
```

**Controller:**
```js
return this.view('main');
```

No data needed.

---

## Layouts & sections

Split design into a **layout** (shell) and **pages** (content).

### Step 1 — Layout

**`ui/layouts/app.taand`**
```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>{{ $title }}</title>
</head>
<body>
  @show content
</body>
</html>
```

`@show content` = placeholder where child content appears.

### Step 2 — Child page

**`ui/ui/about.taand`**
```html
@layout layouts.app

@section content
  <h1>{{ $heading }}</h1>
  <p>Page body here</p>
@end
```

### Step 3 — Pass data

```js
return this.view('pages.about', {
  title: 'About',       // for layout <title>
  heading: 'About us',  // for child <h1>
});
```

### Multiple sections (advanced)

```html
@layout layouts.app

@section sidebar
  <nav>Links</nav>
@end

@section content
  <main>Body</main>
@end
```

Layout:
```html
<aside>@show sidebar</aside>
<main>@show content</main>
```

---

## Partials

Small reusable snippets — like Blade `@include`.

**`ui/partials/badge.taand`**
```html
<span>{{ $label }}</span>
```

**Use in any template:**
```html
@include partials.badge, { label: $badge }
```

Partial receives merged data: parent data + `{ label: $badge }`.

---

## Conditionals

```html
@if $count > 0
  <p>{{ $count }} items found</p>
@elseif $count === 0
  <p>Empty list</p>
@else
  <p>Invalid count</p>
@end
```

Expressions support: `===`, `!==`, `>`, `<`, `&&`, `||`

---

## Loops

**List of objects:**
```html
<ul>
  @each user in $users
    <li>{{ $user.name }}</li>
  @end
</ul>
```

**With index/key:**
```html
@each key, item in $items
  <p>{{ $key }}: {{ $item }}</p>
@end
```

**Controller data:**
```js
users: [{ name: 'Ada' }, { name: 'Lin' }]
```

---

## Output & variables

| Syntax | Behavior | When to use |
|--------|----------|-------------|
| `{{ $name }}` | HTML-escaped | User data, DB values, forms |
| `{! $html !}` | Raw, unescaped | Trusted HTML only |

**Variable rules:**
- Always prefix with `$` in templates: `{{ $user.name }}`
- Pass from controller: `{ user: { name: 'Ada' } }`
- Inside `@each`, loop variable works: `@each user in $users` → `{{ $user.name }}`

---

## Blade comparison

| Taand Blade | Taand Markup |
|---------------|--------------|
| `@extends('layouts.app')` | `@layout layouts.app` |
| `@section('content')` … `@endsection` | `@section content` … `@end` |
| `@yield('content')` | `@show content` |
| `@include('partials.badge')` | `@include partials.badge` |
| `@if` … `@endif` | `@if` … `@end` |
| `@elseif` | `@elseif` |
| `@else` | `@else` |
| `@foreach($u in $users)` … `@endforeach` | `@each user in $users` … `@end` |
| `{{ $x }}` | `{{ $x }}` |
| `{!! $x !!}` | `{! $x !}` |

**Why easier:** no quotes on view names, one `@end` for everything.

---

## Security

| Protection | How |
|------------|-----|
| XSS prevention | `{{ }}` escapes `& < > " '` |
| Path traversal | View names validated; only `ui/` |
| Code injection | Expressions block `eval`, `require`, `process`, etc. |
| Raw HTML | `{! !}` is explicit — developer must trust content |
| Redirects | Controller `redirect()` allows `/path` only |

**Always** use `{{ }}` for anything from users or the database.

---

## Performance

| Stage | What happens |
|-------|--------------|
| First request | `.taand` compiled → `.mjs` in `storage/view-cache/` |
| Next requests | Cached render function loaded from memory |
| File changed | Recompiled automatically (mtime check) |

**Dev tip** — disable cache while editing many templates:

```env
TAAND_VIEW_CACHE=false
```

---

## Live reload

In dev (`TAAND_ENV=local`), saving any `.taand` file:
1. Clears view cache
2. Browser auto-refreshes

No manual restart needed for view changes.

---

## Troubleshooting

### 404 Not Found

| Problem | Fix |
|---------|-----|
| Wrong URL | Check the exact path in `flow/http.js` |
| Route not registered | Check `flow/http.js` |
| Server not restarted | Save route file or restart `npm run dev` |

### `view is not defined`

Add import in `flow/http.js`:
```js
import view from '../start/view.js';
```

Or use a controller: `'HomeController@index'`

### Empty `<title>` or missing data

Layout variables like `{{ $title }}` need data from controller:
```js
return this.view('main', { title: 'My Title' });
```

### View not found

```
[TaandView] View not found: pages.about
```

Create file: `ui/ui/about.taand`

### Missing `@end`

```
[TaandView] Missing @end for block
```

Every `@section`, `@if`, `@each` needs a matching `@end`.

### Old content after edit

- Wait for live reload, or
- Hard refresh browser (Ctrl+F5), or
- Set `TAAND_VIEW_CACHE=false`

---

## Project files

| File | Route | Description |
|------|-------|-------------|
| `main.taand` | `GET /` | taand-style yellow welcome page |
| `HomeController` | `index` | Returns `main` view |

Create additional views under `ui/` as your app grows. See [auth.md](./auth.md) for session-backed forms and CSRF.
