import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { CLASS_NAME_RE } from './JobPayload.js';
import { jobsDir } from '../core/ProjectPaths.js';

/**
 * Resolves job classes from src/jobs/ — blocks unsafe execution.
 */
export class JobResolver {
  constructor(app) {
    this.app = app;
    this.#jobsPath = jobsDir(app.basePath);
    this.#cache = new Map();
  }

  #jobsPath;
  #cache;

  async resolve(payload) {
    const name = payload.job;
    if (!CLASS_NAME_RE.test(name)) {
      throw new Error(`[Taand] Invalid job class [${name}]`);
    }

    const JobClass = await this.#loadClass(name);
    const instance = new JobClass(this.app, payload.data ?? {});

    instance.queue = payload.meta?.queue ?? instance.queue;
    instance.tries = payload.meta?.tries ?? instance.tries;
    instance.timeout = payload.meta?.timeout ?? instance.timeout;
    instance.backoff = payload.meta?.backoff ?? instance.backoff;

    return instance;
  }

  async #loadClass(className) {
    if (this.#cache.has(className)) return this.#cache.get(className);

    const file = path.join(this.#jobsPath, `${className}.js`);
    let mod;

    try {
      mod = await import(pathToFileURL(file).href);
    } catch (err) {
      if (err.code === 'ERR_MODULE_NOT_FOUND') {
        throw new Error(`[Taand] Job [${className}] not found in src/jobs/${className}.js`);
      }
      throw err;
    }

    const exported = mod[className] ?? mod.default;
    if (!exported) {
      throw new Error(`[Taand] Job [${className}] is not exported from src/jobs/${className}.js`);
    }

    this.#cache.set(className, exported);
    return exported;
  }
}
