import { pathToFileURL } from 'node:url';
import { ServiceProvider } from '../core/ServiceProvider.js';
import { EventDispatcher } from '../events/EventDispatcher.js';
import { applicationFile } from '../core/ProjectPaths.js';

export class EventServiceProvider extends ServiceProvider {
  register() {
    this.app.singleton('events', (app) => new EventDispatcher(app));
  }

  async boot() {
    await this.#loadListeners();
  }

  async #loadListeners() {
    const file = applicationFile(this.app.basePath, 'events.js');

    try {
      const mod = await import(pathToFileURL(file).href);
      await mod.default?.(this.app.make('events'), this.app);
    } catch (err) {
      if (err.code !== 'ERR_MODULE_NOT_FOUND') throw err;
    }
  }
}
