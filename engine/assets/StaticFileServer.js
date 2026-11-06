import fs from 'node:fs';
import path from 'node:path';
import { FileResponse } from '../http/FileResponse.js';
import { mimeFromExt } from './mime.js';
import { dispositionForMime } from './mime.js';

const STATIC_EXT = new Set([
  '.css', '.js', '.mjs', '.map',
  '.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.ico',
  '.mp3', '.wav', '.ogg', '.webm',
  '.mp4', '.mov',
  '.woff', '.woff2', '.ttf', '.eot',
  '.pdf', '.txt',
]);

/**
 * Serves web/ and storage/uploads/ with security headers.
 */
export class StaticFileServer {
  constructor(app) {
    this.app = app;
  }

  tryServe(urlPath) {
    const ext = path.extname(urlPath).toLowerCase();

    if (!STATIC_EXT.has(ext) && !urlPath.startsWith('/storage/')) {
      return null;
    }

    const assets = this.app.make('assets');
    const filePath = assets.resolvePublic(urlPath);
    if (!filePath) return null;

    const stat = fs.statSync(filePath);
    const mime = mimeFromExt(filePath);
    const config = this.app.make('config').get('assets', {});
    const cache = config.cache ?? {};

    const headers = {
      'Content-Type': mime,
      'Content-Length': String(stat.size),
      'X-Content-Type-Options': 'nosniff',
      'Content-Disposition': `${dispositionForMime(mime)}; filename="${path.basename(filePath)}"`,
    };

    if (mime === 'image/svg+xml') {
      headers['Content-Security-Policy'] = "default-src 'none'; script-src 'none'; sandbox";
    }

    if (cache.maxAge) {
      headers['Cache-Control'] = cache.immutable
        ? `public, max-age=${cache.maxAge}, immutable`
        : `public, max-age=${cache.maxAge}`;
    }

    return new FileResponse(filePath, 200, headers);
  }
}
