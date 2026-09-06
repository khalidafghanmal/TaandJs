# Feature modules

Organize large features in self-contained folders under `src/features/` — controller, routes, and views together. **Additive feature**: existing `flow/http.js`, `src/actions/`, and top-level `ui/` keep working unchanged.

---

## Quick start

```bash
Taand make:module Billing
npm run dev
```

Open `http://127.0.0.1:2977/billing`

---

## Layout

```
src/features/Billing/
├── BillingController.js
├── routes.js              ← auto-loaded (same Router as web.js)
└── ui/
    └── index.taand
```

| Piece | Location |
|-------|----------|
| Controller | `src/features/{Name}/{Name}Controller.js` |
| Routes | `src/features/{Name}/routes.js` |
| Views | `src/features/{Name}/ui/*.taand` |

Module folder names must be **PascalCase** (`Billing`, `ShopApi`). Invalid names are ignored for security.

---

## How it works

```
flow/http.js          →  loads first (unchanged)
src/features/*/routes.js →  auto-loaded after (alphabetical)
```

- **Same routing system** — `route.get`, groups, middleware, named routes all work.
- **Controllers** — `BillingController@index` resolves from `src/actions/` first, then `src/features/*/`.
- **Views** — use `{slug}.{view}` e.g. `billing.index` → `src/features/Billing/ui/index.taand`.
- Top-level views (`main`, `errors.error`) are unchanged.

---

## Views

| View name | Resolves to |
|-----------|-------------|
| `main` | `ui/main.taand` (global) |
| `billing.index` | `src/features/Billing/ui/index.taand` |
| `billing.admin.list` | `src/features/Billing/ui/admin/list.taand` |

Slug = lowercase first letter of module name (`Billing` → `billing`, `ShopApi` → `shopApi`).

---

## Configuration

`config/app.js`:

```js
modules: {
  enabled: true,      // TAAND_MODULES=false to disable
  autoRoutes: true,   // TAAND_MODULES_AUTO_ROUTES=false to skip auto-load
},
```

Manual route import (when `autoRoutes` is false):

```js
// flow/http.js
import '../src/features/Billing/routes.js';
```

---

## Security

- Module names: `/^[A-Z][a-zA-Z0-9]*$/` only
- View slugs: `/^[a-z][a-zA-Z0-9]*$/` only
- Paths validated — no `..` traversal
- Duplicate `{Name}Controller.js` in two modules → **error** (no ambiguous dispatch)

---

## CLI

```bash
Taand make:module Billing
Taand make:module ShopApi --force
Taand route:list
```

---

## Taand comparison

| Taand (package) | Taand (built-in) |
|-------------------|------------------|
| `Taand feature modules` | `src/features/` + `make:module` |
| `Modules/Billing/Routes/web.php` | `src/features/Billing/routes.js` |
| `Modules/Billing/Resources/views` | `src/features/Billing/ui/` |

Default Taand does **not** include modules; Taand ships this as an optional, zero-config feature.

---

## Coexistence

| Style | Still works? |
|-------|----------------|
| `src/actions/HomeController.js` | ✅ |
| `flow/http.js` | ✅ |
| `ui/main.taand` | ✅ |
| `src/features/Billing/` | ✅ (additive) |

See also: [routing.md](./routing.md), [controllers.md](./controllers.md), [views.md](./views.md), [structure.md](./structure.md).
