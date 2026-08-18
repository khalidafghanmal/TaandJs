import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const stubsDir = path.resolve(__dirname, '..', 'stubs');

/** In-memory template cache — preloaded for daemon mode. */
const templateCache = new Map();

/**
 * Sync template renderer with cached stub bodies.
 * Avoids async I/O on every generator run.
 */
export class TemplateEngine {
  static render(name, vars = {}) {
    let content = templateCache.get(name);
    if (content === undefined) {
      const file = path.join(stubsDir, `${name}.stub`);
      content = fs.readFileSync(file, 'utf8');
      templateCache.set(name, content);
    }

    let out = content;
    for (const [key, value] of Object.entries(vars)) {
      out = out.replaceAll(`{{${key}}}`, String(value));
    }
    return out;
  }

  /** Warm all known stubs — call from daemon preload. */
  static preload(stubNames) {
    for (const name of stubNames) {
      TemplateEngine.render(name, {});
    }
  }

  static preloadAll() {
    TemplateEngine.preload(GENERATOR_STUB_NAMES);
  }

  static clearCache() {
    templateCache.clear();
  }
}

// Lazy import to avoid circular deps when definitions import TemplateEngine
import { GENERATOR_STUB_NAMES } from './definitions.js';

/** @deprecated use TemplateEngine.render */
export function renderStub(name, vars) {
  return Promise.resolve(TemplateEngine.render(name, vars));
}
