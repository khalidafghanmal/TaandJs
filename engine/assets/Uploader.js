import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {
  categoryForMime,
  dispositionForMime,
  extForMime,
  hasSignature,
  isBlockedExtension,
  mimeFromExt,
  sniffMime,
} from './mime.js';

/**
 * Secure file uploads — validated MIME, magic bytes, safe random names.
 */
export class Uploader {
  constructor(app) {
    this.app = app;
    this.#assets = app.make('assets');
  }

  #assets;

  config() {
    return this.app.make('config').get('assets', {});
  }

  /**
   * Save an uploaded file from multipart or raw body field.
   *
   *   const file = await uploader.fromRequest(req, 'photo', { type: 'image' });
   *   // { path, url, mime, size, name }
   */
  async fromRequest(request, field, { type = 'image', folder = 'uploads' } = {}) {
    const file = this.#extractFile(request, field);
    if (!file) {
      throw new Error(`[Taand] No file uploaded for field: ${field}`);
    }

    return this.save(file.buffer, file.originalName, { type, folder });
  }

  async save(buffer, originalName, { type = 'image', folder = 'uploads', disk = null } = {}) {
    const config = this.config();
    const allowed = config.allowed ?? {};
    const limits = config.limits ?? {};

    if (isBlockedExtension(originalName)) {
      throw new Error('[Taand] File type not allowed');
    }

    const declaredMime = mimeFromExt(originalName);
    const sniffed = sniffMime(buffer);
    // Types with a magic-byte signature must actually match it; the client name is only a hint.
    if (!sniffed && hasSignature(declaredMime)) {
      throw new Error(`[Taand] Invalid file type: expected ${type}`);
    }
    const mime = sniffed ?? declaredMime;

    const category = categoryForMime(mime, allowed);
    if (!category || (type && category !== type)) {
      throw new Error(`[Taand] Invalid file type: expected ${type}`);
    }

    // Stored extension follows the validated type, so it is served with the same Content-Type.
    const ext = extForMime(mime);

    const maxSize = limits[category] ?? limits.default ?? 5_242_880;
    if (buffer.length > maxSize) {
      throw new Error('[Taand] File too large');
    }

    const safeFolder = folder.replace(/[^a-zA-Z0-9_/-]/g, '').replace(/\.\./g, '');
    const filename = `${crypto.randomUUID()}${ext}`;
    const relative = path.posix.join(safeFolder, filename).replace(/\\/g, '/');

    const resolvedDisk = disk ?? this.app.make('config').get('filesystems.default', 'local');
    if (this.app.has('storage') && resolvedDisk !== 'local') {
      const result = await this.app.make('storage').disk(resolvedDisk).put(relative, buffer, {
        contentType: mime,
      });
      return {
        path: result.path,
        url: this.app.make('storage').disk(resolvedDisk).url(result.path),
        mime,
        size: buffer.length,
        name: filename,
        disposition: dispositionForMime(mime),
        disk: resolvedDisk,
      };
    }

    const absolute = path.join(this.#assets.storageDir, relative);

    fs.mkdirSync(path.dirname(absolute), { recursive: true });
    fs.writeFileSync(absolute, buffer, { mode: 0o644 });

    return {
      path: relative.replace(/\\/g, '/'),
      url: this.#assets.storageUrl(relative),
      mime,
      size: buffer.length,
      name: filename,
      disposition: dispositionForMime(mime),
      disk: 'local',
    };
  }

  #extractFile(request, field) {
    const contentType = request.header('content-type') ?? '';

    if (contentType.includes('multipart/form-data')) {
      return this.#parseMultipart(request.rawBody, contentType, field);
    }

    const raw = request.rawBody;
    if (!raw?.length) return null;

    const name = request.header('x-upload-filename') ?? `${field}.bin`;
    return { buffer: raw, originalName: name };
  }

  #parseMultipart(buffer, contentType, field) {
    const boundary = contentType.match(/boundary=(.+)$/i)?.[1]?.trim();
    if (!boundary || !buffer?.length) return null;

    const boundaryBuffer = Buffer.from(`--${boundary}`);
    let offset = 0;

    while (offset < buffer.length) {
      const start = buffer.indexOf(boundaryBuffer, offset);
      if (start === -1) break;

      const partStart = start + boundaryBuffer.length;
      if (buffer[partStart] === 0x2d && buffer[partStart + 1] === 0x2d) break;

      const headerEnd = buffer.indexOf('\r\n\r\n', partStart);
      if (headerEnd === -1) break;

      const headers = buffer.slice(partStart, headerEnd).toString('utf8');
      const contentStart = headerEnd + 4;
      const nextBoundary = buffer.indexOf(boundaryBuffer, contentStart);
      const contentEnd = nextBoundary === -1 ? buffer.length : nextBoundary - 2;

      if (headers.includes(`name="${field}"`)) {
        const filenameMatch = headers.match(/filename="([^"]+)"/i);
        if (filenameMatch) {
          return {
            buffer: buffer.slice(contentStart, contentEnd),
            originalName: filenameMatch[1],
          };
        }
      }

      offset = contentStart;
    }

    return null;
  }
}
