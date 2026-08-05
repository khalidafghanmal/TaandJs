import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

/**
 * Asset URLs — Taand asset() and storage() helpers.
 */
import { inProject, publicDir } from '../core/ProjectPaths.js';

export class AssetManager {
  constructor(app) {
    this.app = app;
    this.#basePath = app.basePath;
    this.#publicDir = publicDir(app.basePath);
    this.#storageDir = inProject(app.basePath, 'var', 'uploads');
  }

  #basePath;
  #publicDir;
  #storageDir;
  #hashCache = new Map();

  get publicDir() {
    return this.#publicDir;
  }

  get storageDir() {
    return this.#storageDir;
  }

  config() {
    return this.app.make('config').get('assets', {});
  }

  /**
   * Public asset URL — files in web/
   *   asset('images/logo.png') → /images/logo.png
   */
  url(relativePath) {
    const cleaned = AssetManager.#cleanPath(relativePath);
    const config = this.config();
    const base = config.url?.replace(/\/$/, '') ?? '';
    let url = `/${cleaned}`;

    if (config.version) {
      url += `${url.includes('?') ? '&' : '?'}v=${encodeURIComponent(config.version)}`;
    } else if (this.app.make('config').get('app.env') === 'production') {
      const hash = this.#fileHash(path.join(this.#publicDir, cleaned));
      if (hash) url += `?v=${hash}`;
    }

    return `${base}${url}`;
  }

  /**
   * Uploaded file URL — files in storage/app/web/
   *   storage('uploads/photo.jpg') → /storage/uploads/photo.jpg
   */
  storageUrl(relativePath) {
    const cleaned = AssetManager.#cleanPath(relativePath);
    const prefix = this.config().storagePrefix ?? '/storage';
    const base = this.config().url?.replace(/\/$/, '') ?? '';
    return `${base}${prefix}/${cleaned}`;
  }

  resolvePublic(requestPath) {
    if (requestPath.startsWith('/storage/')) {
      const relative = requestPath.slice('/storage/'.length);
      return this.#resolveSafe(this.#storageDir, relative);
    }

    return this.#resolveSafe(this.#publicDir, requestPath.replace(/^\//, ''));
  }

  #resolveSafe(root, relative) {
    const cleaned = AssetManager.#cleanPath(relative);
    if (!cleaned) return null;

    const absolute = path.resolve(root, cleaned);
    const rootResolved = path.resolve(root);

    if (!absolute.startsWith(rootResolved + path.sep) && absolute !== rootResolved) {
      return null;
    }

    if (!fs.existsSync(absolute) || !fs.statSync(absolute).isFile()) {
      return null;
    }

    return absolute;
  }

  static #cleanPath(input) {
    if (typeof input !== 'string') return '';

    return input
      .replace(/\\/g, '/')
      .replace(/^\/+/, '')
      .split('/')
      .filter((part) => part && part !== '.' && part !== '..')
      .join('/');
  }

  #fileHash(filePath) {
    if (this.#hashCache.has(filePath)) return this.#hashCache.get(filePath);

    try {
      const stat = fs.statSync(filePath);
      const key = `${filePath}:${stat.mtimeMs}:${stat.size}`;
      const hash = crypto.createHash('sha256').update(key).digest('hex').slice(0, 8);
      this.#hashCache.set(filePath, hash);
      return hash;
    } catch {
      return null;
    }
  }

  ensureDirectories() {
    fs.mkdirSync(this.#publicDir, { recursive: true });
    fs.mkdirSync(this.#storageDir, { recursive: true });
    fs.mkdirSync(path.join(this.#storageDir, 'uploads'), { recursive: true });
  }
}
