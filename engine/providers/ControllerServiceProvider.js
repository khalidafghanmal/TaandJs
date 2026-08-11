import { ServiceProvider } from '../core/ServiceProvider.js';
import { ControllerDispatcher } from '../routing/ControllerDispatcher.js';

export class ControllerServiceProvider extends ServiceProvider {
  register() {
    this.app.singleton('controllers', () => new ControllerDispatcher(this.app));
  }
}
