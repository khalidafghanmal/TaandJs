# Storage (S3 & local disks)

taand-style **filesystem disks** — local uploads or Amazon S3 / compatible storage for cloud deploys.

---

## Configuration

`config/filesystems.js`:

```js
export default {
  default: env('FILESYSTEM_DISK', 'local'),
  disks: {
    local: { driver: 'local', root: 'storage/uploads', url: '/storage' },
    s3: {
      driver: 's3',
      key: env('AWS_ACCESS_KEY_ID'),
      secret: env('AWS_SECRET_ACCESS_KEY'),
      region: env('AWS_DEFAULT_REGION', 'us-east-1'),
      bucket: env('AWS_BUCKET'),
      url: env('AWS_URL'),
      endpoint: env('AWS_ENDPOINT'),  // MinIO, R2, etc.
      visibility: 'private',          // default — objects are not publicly readable
    },
  },
};
```

### Environment (S3)

```env
FILESYSTEM_DISK=s3
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_DEFAULT_REGION=us-east-1
AWS_BUCKET=my-app-uploads
AWS_URL=https://my-app-uploads.s3.amazonaws.com
```

---

## Usage

### In controllers

```js
const disk = this.app.make('storage').disk('s3');
await disk.put('private/doc.pdf', buffer, { contentType: 'application/pdf' });
const signed = await disk.temporaryUrl('private/doc.pdf', 3600);

// Opt in per write for files anyone may fetch by URL
await disk.put('uploads/photo.jpg', buffer, { contentType: 'image/jpeg', visibility: 'public' });
const url = disk.url('uploads/photo.jpg');
```

S3 objects are **private by default**. Pass `{ visibility: 'public' }` to `put()` (or set `visibility: 'public'` on a disk dedicated to public files) only for content that should be world-readable; serve everything else with `temporaryUrl()`.

### Uploads (automatic disk)

```js
await this.upload(req, 'photo', { type: 'image', disk: 's3' });
```

When `FILESYSTEM_DISK=s3`, uploads go to S3 automatically. The uploader writes them with public visibility, because it returns a public URL for them.

---

## Supported drivers

| Driver | Use case |
|--------|----------|
| `local` | Dev, single-server |
| `s3` | AWS S3, MinIO, Cloudflare R2, DigitalOcean Spaces |

---

## vs Taand

| Taand | Taand |
|---------|-------|
| `Storage::disk('s3')` | `app.make('storage').disk('s3')` |
| `config/filesystems.php` | `config/filesystems.js` |
| `FILESYSTEM_DISK=s3` | Same env name |

See also: [assets.md](./assets.md), [production.md](./production.md).
