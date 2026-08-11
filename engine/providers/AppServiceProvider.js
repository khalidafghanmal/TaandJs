import { ServiceProvider } from '../core/ServiceProvider.js';
import { ErrorRenderer } from '../http/ErrorRenderer.js';

export class AppServiceProvider extends ServiceProvider {
  register() {
    this.app.singleton('errors', (app) => new ErrorRenderer(app));
  }

  boot() {}
}
