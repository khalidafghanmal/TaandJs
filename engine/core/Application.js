import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import { Container } from './Container.js';
import { HttpKernel } from './HttpKernel.js';
import { Config } from './Config.js';
import { ExceptionHandler } from './ExceptionHandler.js';
import { loadEnv } from './Env.js';
import { Router } from '../routing/Router.js';
import { RouteRegistrar } from '../routing/RouteRegistrar.js';
import { Pipeline } from '../middleware/Pipeline.js';
import { MiddlewareRegistry } from '../middleware/MiddlewareRegistry.js';
import { Request } from '../http/Request.js';
import { runWithRequest } from '../support/RequestContext.js';
import { ProjectPaths, inProject, routesFilePath } from './ProjectPaths.js';
import { loadSettingsRegistry } from './SettingsLoader.js';

/**
 * Application — the heart of TaandJs.
 * Mirrors Taand's Illuminate\Foundation\Application bootstrap flow.
 */
export class Application extends Container {
  constructor(basePath) {
    super();
    this.basePath = basePath;
    this.#providers = [];
    this.#registerCore();
  }

  #providers;
  #routeFile = null;
  #booted = false;
  #routesLoaded = false;

  get debug() {
    return this.make('config').get('app.debug', true);
  }

  #registerCore() {
    this.singleton('app', () => this);
    this.singleton('config', () => new Config());
    this.singleton('middleware', () => new MiddlewareRegistry());
    this.singleton('pipeline', () => new Pipeline(this));
    this.singleton('exceptions', () => new ExceptionHandler(this));
    this.singleton('router', () => {
      const router = new Router();
      router.setApplication(this);
      router.setPipeline(this.make('pipeline'));
      return router;
    });
    this.singleton('kernel', () => new HttpKernel(this));
    this.singleton('route', () => new RouteRegistrar(this.make('router')));
  }

  static configure({ basePath } = {}) {
    const resolvedBase = basePath ?? path.dirname(fileURLToPath(import.meta.url));
    return new Application(resolvedBase);
  }

  withRouting(routeFile) {
    this.#routeFile = routeFile;
    return this;
  }

  withProviders(...providers) {
    this.#providers.push(...providers);
    return this;
  }

  async bootstrap() {
    if (this.#booted) return this;

    loadEnv(this.basePath);
    await this.#loadConfig();
    await this.#bootProviders();
    if (!this.#routesLoaded) {
      await this.#loadRoutes();
    }

    this.#booted = true;
    return this;
  }

  /**
   * Lightweight CLI bootstrap — skips DB, providers, and builds.
   * @param {'routes'|'config'|'full'} scope
   */
  async bootstrapCli(scope = 'full') {
    if (scope === 'full') return this.bootstrap();

    if (scope === 'config') {
      loadEnv(this.basePath);
      await this.#loadConfig();
      return this;
    }

    if (scope === 'routes') {
      if (!this.#routesLoaded) {
        await this.#loadRoutes();
        this.#routesLoaded = true;
      }
      return this;
    }

    return this.bootstrap();
  }

  async #loadConfig() {
    const config = this.make('config');
    const registry = await loadSettingsRegistry(this.basePath);
    config.merge(registry);
  }

  async #bootProviders() {
    const instances = this.#providers.map((Provider) => new Provider(this));

    for (const provider of instances) {
      provider.register();
    }

    for (const provider of instances) {
      await provider.boot();
    }
  }

  async #loadRoutes() {
    if (!this.#routeFile) return;

    await import(this.#routeImportUrl());
    const { loadModuleRoutes } = await import('../modules/loadModuleRoutes.js');
    await loadModuleRoutes(this);
    this.#routesLoaded = true;
  }

  #routeImportUrl(reload = false) {
    const fileUrl = this.#routeFile.startsWith('file://')
      ? this.#routeFile
      : pathToFileURL(path.resolve(this.#routeFile)).href;

    return reload ? `${fileUrl}?taand-reload=${Date.now()}` : fileUrl;
  }

  async reloadRoutes() {
    if (!this.#routeFile) return;

    this.make('router').reset();
    await import(this.#routeImportUrl(true));
    const { loadModuleRoutes } = await import('../modules/loadModuleRoutes.js');
    await loadModuleRoutes(this, { reload: true });
    this.#routesLoaded = true;
  }

  async reloadConfig() {
    const config = this.make('config');
    const registry = await loadSettingsRegistry(this.basePath, { reloadStamp: Date.now() });
    config.merge(registry);

    if (this.has('view')) {
      this.make('view').flush();
    }
  }

  async handleRequest(rawRequest) {
    try {
      const request = await Request.from(rawRequest);
      return runWithRequest(request, () => this.make('kernel').handle(request));
    } catch (error) {
      const status = error?.status ?? 500;
      const message = status < 500 || this.debug ? error.message : undefined;
      return {
        response: await this.make('errors').respond(null, status, { message }),
        terminate: async () => {},
      };
    }
  }

  getRouteRegistrar() {
    return this.make('route');
  }
}
