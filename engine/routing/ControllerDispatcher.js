import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { controllersDir } from '../core/ProjectPaths.js';
import { resolveModuleControllerFile } from '../modules/ModulePaths.js';

const CONTROLLER_PATTERN = /^[A-Z][A-Za-z0-9]*$/;
const METHOD_PATTERN = /^[a-zA-Z_][a-zA-Z0-9_]*$/;
const BLOCKED_METHODS = new Set(['constructor', 'prototype', '__proto__']);

/**
 * Resolves and dispatches controller actions with cached handlers.
 * Supports: 'HomeController@index' or [HomeController, 'index']
 */
export class ControllerDispatcher {
  constructor(app) {
    this.app = app;
    this.#handlers = new Map();
    this.#instances = new Map();
    this.#controllersPath = controllersDir(app.basePath);
  }

  #handlers;
  #instances;
  #controllersPath;

  static isControllerAction(action) {
    if (Array.isArray(action) && action.length === 2) return true;
    if (typeof action === 'string' && action.includes('@')) return true;
    return false;
  }

  async resolve(action) {
    const key = this.#actionKey(action);

    if (this.#handlers.has(key)) {
      return this.#handlers.get(key);
    }

    const handler = await this.#compile(action);
    this.#handlers.set(key, handler);
    return handler;
  }

  flush() {
    this.#handlers.clear();
    this.#instances.clear();
  }

  #actionKey(action) {
    if (typeof action === 'string') return action;
    if (Array.isArray(action)) return `${action[0].name}@${action[1]}`;
    throw new TypeError('[Taand] Invalid controller action');
  }

  async #compile(action) {
    const { ControllerClass, method } = await this.#load(action);
    this.#assertMethod(ControllerClass, method);

    return async (request) => {
      const instance = this.#getInstance(ControllerClass);
      return instance[method](request);
    };
  }

  async #load(action) {
    if (Array.isArray(action)) {
      const [ControllerClass, method] = action;
      if (typeof ControllerClass !== 'function' || typeof method !== 'string') {
        throw new TypeError('[Taand] Controller action must be [ControllerClass, "method"]');
      }
      return { ControllerClass, method };
    }

    const [name, method] = action.split('@');
    if (!CONTROLLER_PATTERN.test(name) || !METHOD_PATTERN.test(method)) {
      throw new Error(`[Taand] Invalid controller action: ${action}`);
    }

    const filePath = path.join(this.#controllersPath, `${name}.js`);
    let resolved = path.resolve(filePath);

    if (!resolved.startsWith(this.#controllersPath + path.sep)) {
      throw new Error(`[Taand] Invalid controller path: ${name}`);
    }

    if (!fs.existsSync(resolved)) {
      const moduleFile = resolveModuleControllerFile(this.app.basePath, name);
      if (moduleFile) {
        resolved = moduleFile;
      } else {
        throw new Error(`[Taand] Controller not found: ${name}`);
      }
    }

    const mod = await import(`${pathToFileURL(resolved).href}?t=${Date.now()}`);
    const ControllerClass = mod.default ?? mod[name];

    if (typeof ControllerClass !== 'function') {
      throw new Error(`[Taand] Controller not found: ${name}`);
    }

    return { ControllerClass, method };
  }

  #getInstance(ControllerClass) {
    if (!this.#instances.has(ControllerClass)) {
      this.#instances.set(ControllerClass, new ControllerClass(this.app));
    }
    return this.#instances.get(ControllerClass);
  }

  #assertMethod(ControllerClass, method) {
    if (BLOCKED_METHODS.has(method) || method.startsWith('_')) {
      throw new Error(`[Taand] Method not allowed: ${method}`);
    }

    if (typeof ControllerClass.prototype[method] !== 'function') {
      throw new Error(`[Taand] Method not found: ${ControllerClass.name}@${method}`);
    }
  }
}
