import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { ServiceProvider } from '../core/ServiceProvider.js';
import { ScheduleManager } from '../schedule/ScheduleManager.js';
import { applicationFile } from '../core/ProjectPaths.js';

export class ScheduleServiceProvider extends ServiceProvider {
  register() {
    this.app.singleton('schedule', (app) => new ScheduleManager(app));
  }

  async boot() {
    await this.#loadSchedule();
  }

  async #loadSchedule() {
    const file = applicationFile(this.app.basePath, 'schedule.js');

    try {
      const mod = await import(pathToFileURL(file).href);
      await mod.default?.(this.app.make('schedule'), this.app);
    } catch (err) {
      if (err.code !== 'ERR_MODULE_NOT_FOUND') throw err;
    }
  }
}
