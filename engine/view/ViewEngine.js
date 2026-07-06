import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { ViewFinder } from './ViewFinder.js';
import { TaandCompiler } from './TaandCompiler.js';
import { escapeHtml } from './escape.js';
import { VIEW_COMPILER_VERSION } from './viewHelpers.js';
import { peek } from '../support/Debug.js';
import { text } from '../support/Text.js';
import { none, some } from '../support/Value.js';
import { tick } from '../support/Tick.js';
import { classNames as buildClassNames, selected as buildSelected, checked as buildChecked } from '../support/ViewForm.js';
import { formErrorsFromFlash } from '../support/FormErrors.js';

/**
 * TaandView engine — secure compiled templates with disk cache.
 */
export class ViewEngine {
  constructor(app) {
    this.app = app;
    this.#compiler = new TaandCompiler();
    this.#renderCache = new Map();
  }

  #compiler;
  #renderCache;

  configure({ viewsPath, cachePath, cacheEnabled = true, basePath = null }) {
    this.#viewsPath = viewsPath;
    this.#cachePath = cachePath;
    this.#cacheEnabled = cacheEnabled;
    this.#finder = new ViewFinder(viewsPath, { basePath });
    fs.mkdirSync(cachePath, { recursive: true });
    return this;
  }

  #viewsPath;
  #cachePath;
  #cacheEnabled;
  #finder;

  async render(name, data = {}) {
    const renderFn = await this.#getRenderFunction(name);
    const helpers = this.#createHelpers(data);
    const result = await renderFn(data, helpers);

    if (result.layout) {
      return this.#renderLayout(result.layout, data, result.slots);
    }

    return result.html;
  }

  async #renderLayout(layoutName, data, slots) {
    const renderFn = await this.#getRenderFunction(layoutName);
    const helpers = this.#createHelpers(data, slots);
    const result = await renderFn(data, helpers);
    return result.html;
  }

  #createHelpers(data, slots = {}) {
    const engine = this;
    const app = this.app;
    const assets = this.app.has('assets') ? this.app.make('assets') : null;
    const csrfToken = data._csrf ?? '';
    const oldInput = data._old ?? {};
    const validationErrors = data._errors ?? {};

    return {
      escape: escapeHtml,
      asset(relativePath) {
        return assets ? assets.url(relativePath) : `/${relativePath}`;
      },
      storage(relativePath) {
        return assets ? assets.storageUrl(relativePath) : `/storage/${relativePath}`;
      },
      csrf_token() {
        return csrfToken;
      },
      csrf_field() {
        if (!csrfToken) return '';
        return `<input type="hidden" name="_token" value="${escapeHtml(csrfToken)}">`;
      },
      cfg(key, fallback = null) {
        return app.has('config') ? app.make('config').get(key, fallback) : fallback;
      },
      path(name, params = {}) {
        return app.make('route').url(name, params);
      },
      prev(key, fallback = '') {
        if (key == null || key === '') return oldInput;
        const value = oldInput[key];
        return value === undefined || value === null ? fallback : value;
      },
      peek(...values) {
        return peek(...values);
      },
      text(value) {
        return text(value);
      },
      none(value) {
        return none(value);
      },
      some(value) {
        return some(value);
      },
      tick(value) {
        return tick(value);
      },
      e(value) {
        return escapeHtml(value);
      },
      errors(field) {
        return formErrorsFromFlash({ errors: validationErrors }, field);
      },
      classNames(input) {
        return buildClassNames(input);
      },
      selected(name, value) {
        return buildSelected(name, value, oldInput[name]);
      },
      checked(name, value) {
        return buildChecked(name, value, oldInput[name]);
      },
      iterate(value) {
        if (value === null || value === undefined) return [];
        if (Array.isArray(value)) return value.entries();
        if (typeof value === 'object') return Object.entries(value);
        return [];
      },
      fill(name) {
        return slots[name] ?? '';
      },
      async partial(name, partialData) {
        return engine.render(name, { ...data, ...partialData });
      },
    };
  }

  async #getRenderFunction(name) {
    if (this.#renderCache.has(name)) {
      return this.#renderCache.get(name);
    }

    const sourcePath = this.#finder.find(name);
    const compiled = await this.#compile(sourcePath, name);
    this.#renderCache.set(name, compiled);
    return compiled;
  }

  async #compile(sourcePath, name) {
    const source = fs.readFileSync(sourcePath, 'utf8');
    const { code } = this.#compiler.compile(source);
    const cacheFile = this.#cacheFilePath(name, source);

    if (this.#cacheEnabled) {
      const needsCompile =
        !fs.existsSync(cacheFile) ||
        fs.statSync(sourcePath).mtimeMs > fs.statSync(cacheFile).mtimeMs;

      if (needsCompile) {
        fs.writeFileSync(cacheFile, code, 'utf8');
      }

      const mod = await import(`${pathToFileURL(cacheFile).href}?t=${Date.now()}`);
      return mod.default;
    }

    const dataUrl = `data:text/javascript,${encodeURIComponent(code)}`;
    const mod = await import(dataUrl);
    return mod.default;
  }

  #cacheFilePath(name, source) {
    const hash = crypto.createHash('sha256').update(source).digest('hex').slice(0, 16);
    const safeName = name.replace(/[^a-zA-Z0-9._-]/g, '_');
    return path.join(this.#cachePath, `${safeName}.${VIEW_COMPILER_VERSION}.${hash}.mjs`);
  }

  flush() {
    this.#renderCache.clear();

    if (!this.#cachePath || !fs.existsSync(this.#cachePath)) return;

    for (const file of fs.readdirSync(this.#cachePath)) {
      if (file.endsWith('.mjs')) {
        fs.unlinkSync(path.join(this.#cachePath, file));
      }
    }
  }
}
