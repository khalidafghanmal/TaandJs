# Assets & uploads

TaandJs provides taand-style **public assets** and **secure file uploads** — images, audio, video, documents, CSS, JS, and fonts.

## Directory layout

```
web/                    ← Static files you ship (CSS, JS, images)
  css/
  js/
  images/

storage/uploads/        ← User uploads (served at /storage/...)
  uploads/
```

| Location | URL | Helper |
|----------|-----|--------|
| `web/images/logo.png` | `/images/logo.png` | `asset('images/logo.png')` |
| `storage/uploads/uploads/abc.jpg` | `/storage/uploads/abc.jpg` | `storage('uploads/abc.jpg')` |

---

## Use in views

```html
<link rel="stylesheet" href="{{ asset('css/app.css') }}">
<script src="{{ asset('js/app.js') }}"></script>

<img src="{{ asset('images/logo.png') }}" alt="Logo">

<img src="{{ storage($photo) }}" alt="Upload">
<video src="{{ storage($video) }}" controls></video>
<audio src="{{ storage($audio) }}" controls></audio>
```

`asset()` and `storage()` work inside `{{ }}` — no import needed in templates.

---

## Use in controllers

```js
import { Controller } from '../../engine/core/Controller.js';

export class MediaController extends Controller {
  show() {
    return this.view('media', {
      logo: this.asset('images/logo.png'),
      photo: this.storage('uploads/abc.jpg'),
    });
  }

  async upload(req) {
    const file = await this.upload(req, 'photo', { type: 'image', folder: 'uploads' });

    return {
      url: file.url,
      path: file.path,
      mime: file.mime,
      size: file.size,
    };
  }
}
```

### Upload from a form

```html
<form method="POST" action="/upload" enctype="multipart/form-data">
  <input type="file" name="photo" accept="image/*">
  <button type="submit">Upload</button>
</form>
```

```js
route.post('/upload', 'MediaController@upload').middleware('web');
```

---

## Use in routes

```js
import asset from '../start/asset.js';
import { storage } from '../start/asset.js';

route.get('/api/config', () => ({
  logo: asset('images/logo.png'),
  cdn: asset('js/app.js'),
}));
```

---

## Configuration

`settings/platform.js` → `static` (registry key `assets`):

```js
static: {
  url: '',                    // CDN origin — TAAND_ASSET_URL
  version: '',                // Manual cache bust — TAAND_ASSET_VERSION
  storagePrefix: '/storage',

  limits: {
    image: 5 * 1024 * 1024,   // 5 MB
    audio: 20 * 1024 * 1024,
    video: 100 * 1024 * 1024,
    document: 10 * 1024 * 1024,
    default: 5 * 1024 * 1024,
  },

  allowed: {
    // SVG omitted — it can carry script and enable stored XSS when served inline
    image: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
    audio: ['audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/webm', 'audio/mp4'],
    video: ['video/mp4', 'video/webm', 'video/ogg', 'video/quicktime'],
    document: ['application/pdf', 'text/plain'],
  },

  cache: {
    maxAge: 604800,
    immutable: true,
  },
},
```

`.env`:

```env
TAAND_ASSET_URL=
TAAND_ASSET_VERSION=1.0.0
```

---

## Upload types

| `type` option | Allowed | Max size (default) |
|---------------|---------|-------------------|
| `image` | JPEG, PNG, GIF, WebP | 5 MB |
| `audio` | MP3, WAV, OGG, WebM, MP4 | 20 MB |
| `video` | MP4, WebM, OGG, MOV | 100 MB |
| `document` | PDF, TXT | 10 MB |

```js
await this.upload(req, 'avatar', { type: 'image', folder: 'avatars' });
await this.upload(req, 'track', { type: 'audio', folder: 'audio' });
await this.upload(req, 'clip', { type: 'video', folder: 'videos' });
await this.upload(req, 'doc', { type: 'document', folder: 'docs' });
```

Returns:

```js
{
  path: 'uploads/uuid.jpg',
  url: '/storage/uploads/uuid.jpg',
  mime: 'image/jpeg',
  size: 12345,
  name: 'uuid.jpg',
  disposition: 'inline',
}
```

---

## Security (vs typical setups)

| Feature | Detail |
|---------|--------|
| Path traversal | Blocked — `..` and absolute paths rejected |
| Random filenames | UUID — original name never used on disk |
| MIME validation | Declared type + magic-byte sniffing |
| Blocked extensions | `.php`, `.js`, `.html`, `.exe`, etc. cannot upload |
| Storage isolation | Only `storage/uploads/` is web-accessible |
| `nosniff` | `X-Content-Type-Options` on every static file |
| Safe disposition | `inline` for media, `attachment` for documents |
| No script execution | Uploads never served from executable paths |
| Size limits | Per category in config |

---

## Static file serving

The dev server serves `web/` and `/storage/*` **before** the router — no route needed for assets.

Supported extensions: `.css`, `.js`, `.jpg`, `.png`, `.gif`, `.webp`, `.svg`, `.mp3`, `.wav`, `.mp4`, `.webm`, `.pdf`, `.woff2`, `.ico`, and more.

Large files (video) are **streamed** from disk — not loaded into memory.

---

## Production CDN

Set a CDN or full asset URL:

```env
TAAND_ASSET_URL=https://cdn.example.com
```

```js
asset('images/logo.png')  // → https://cdn.example.com/images/logo.png
```

---

## Taand comparison

| Taand | Taand |
|---------|-------|
| `web/` | `web/` |
| `storage/uploads` | `storage/uploads` |
| `asset('css/app.css')` | `asset('css/app.css')` |
| `Storage::url('file.jpg')` | `storage('uploads/file.jpg')` |
| `automatic /storage mapping` | Automatic `/storage` mapping |
| `$request->file('photo')` | `await this.upload(req, 'photo')` |

---

## Quick reference

```js
// Views
{{ asset('images/logo.png') }}
{{ storage($user.avatar) }}

// Controller
this.asset('css/app.css')
this.storage('uploads/photo.jpg')
await this.upload(req, 'photo', { type: 'image' })

// Route / bootstrap
import asset, { storage } from '../start/asset.js';
```

See also [views.md](./views.md) and [controllers.md](./controllers.md).
