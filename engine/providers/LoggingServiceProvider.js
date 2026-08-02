import { ServiceProvider } from '../core/ServiceProvider.js';
import { LogManager } from '../logging/LogManager.js';

export class LoggingServiceProvider extends ServiceProvider {
  register() {
    this.app.singleton('log', (app) => new LogManager(app));
  }

  boot() {}
}
