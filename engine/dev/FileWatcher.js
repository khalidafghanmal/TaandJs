import fs from 'node:fs';
import path from 'node:path';

const IGNORED = new Set(['node_modules', '.git', 'storage', 'terminals']);
const DEBOUNCE_MS = 120;

/**
 * Secure filesystem watcher — only paths inside basePath, debounced.
 */
export class FileWatcher {
  constructor(basePath, { paths, onChange }) {
    this.#basePath = path.resolve(basePath);
    this.#paths = paths.map((p) => path.resolve(this.#basePath, p));
    this.#onChange = onChange;
    this.#watchers = [];
    this.#pending = new Map();
  }

  #basePath;
  #paths;
  #onChange;
  #watchers;
  #pending;

  start() {
    for (const dir of this.#paths) {
      if (!fs.existsSync(dir)) continue;
      this.#watchDir(dir);
    }
  }

  stop() {
    for (const watcher of this.#watchers) {
      watcher.close();
    }
    this.#watchers = [];
    this.#pending.clear();
  }

  #watchDir(dir) {
    if (!this.#isInsideBase(dir)) return;

    const watcher = fs.watch(dir, { recursive: true }, (_, filename) => {
      if (!filename) return;
      this.#schedule(path.join(dir, filename));
    });

    this.#watchers.push(watcher);
  }

  #schedule(filePath) {
    const resolved = path.resolve(filePath);

    if (!this.#isInsideBase(resolved)) return;
    if (this.#shouldIgnore(resolved)) return;

    const key = resolved;
    if (this.#pending.has(key)) clearTimeout(this.#pending.get(key));

    this.#pending.set(
      key,
      setTimeout(() => {
        this.#pending.delete(key);
        this.#onChange(resolved);
      }, DEBOUNCE_MS),
    );
  }

  #isInsideBase(target) {
    const relative = path.relative(this.#basePath, target);
    return relative && !relative.startsWith('..') && !path.isAbsolute(relative);
  }

  #shouldIgnore(filePath) {
    const parts = filePath.split(path.sep);
    return parts.some((part) => IGNORED.has(part));
  }
}
