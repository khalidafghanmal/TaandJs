import fs from 'node:fs';
import path from 'node:path';
import { resolveModuleViewFile } from '../modules/ModulePaths.js';

const SAFE_NAME = /^[a-zA-Z][a-zA-Z0-9._\-]*$/;

/**
 * Resolves view names to safe file paths inside ui/ and src/features views.
 */
export class ViewFinder {
  constructor(viewsPath, { basePath = null } = {}) {
    this.viewsPath = path.resolve(viewsPath);
    this.basePath = basePath;
  }

  find(name) {
    if (this.basePath) {
      const moduleView = resolveModuleViewFile(this.basePath, name);
      if (moduleView) return moduleView;
    }

    const relative = this.#toRelativePath(name);
    const filePath = path.resolve(this.viewsPath, `${relative}.taand`);

    if (!filePath.startsWith(this.viewsPath + path.sep) && filePath !== this.viewsPath) {
      throw new Error(`[TaandView] Invalid view path: ${name}`);
    }

    if (!fs.existsSync(filePath)) {
      throw new Error(`[TaandView] View not found: ${name}`);
    }

    return filePath;
  }

  #toRelativePath(name) {
    if (!SAFE_NAME.test(name)) {
      throw new Error(`[TaandView] Invalid view name: ${name}`);
    }
    return name.split('.').join(path.sep);
  }
}
