import fs from 'node:fs';
import path from 'node:path';

/**
 * Local filesystem storage driver.
 */
export class LocalDriver {
  constructor(app, config) {
    this.app = app;
    this.#root = path.join(app.basePath, config.root ?? 'var/uploads');
    this.#url = config.url ?? '/storage';
    this.#visibility = config.visibility ?? 'public';
    fs.mkdirSync(this.#root, { recursive: true });
  }

  #root;
  #url;
  #visibility;

  async put(relativePath, contents, options = {}) {
    const safe = this.#safePath(relativePath);
    const absolute = path.join(this.#root, safe);
    fs.mkdirSync(path.dirname(absolute), { recursive: true });
    fs.writeFileSync(absolute, contents, { mode: this.#visibility === 'public' ? 0o644 : 0o600 });
    return { path: safe.replace(/\\/g, '/'), disk: 'local' };
  }

  async get(relativePath) {
    const absolute = path.join(this.#root, this.#safePath(relativePath));
    if (!fs.existsSync(absolute)) return null;
    return fs.readFileSync(absolute);
  }

  async delete(relativePath) {
    const absolute = path.join(this.#root, this.#safePath(relativePath));
    try {
      fs.unlinkSync(absolute);
      return true;
    } catch {
      return false;
    }
  }

  async exists(relativePath) {
    return fs.existsSync(path.join(this.#root, this.#safePath(relativePath)));
  }

  url(relativePath) {
    const safe = this.#safePath(relativePath).replace(/\\/g, '/');
    const prefix = this.#url.replace(/\/$/, '');
    return `${prefix}/${safe}`;
  }

  #safePath(relativePath) {
    return String(relativePath).replace(/\\/g, '/').replace(/\.\./g, '').replace(/^\/+/, '');
  }
}
