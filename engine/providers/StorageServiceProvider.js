import { ServiceProvider } from '../core/ServiceProvider.js';
import { StorageManager } from '../storage/StorageManager.js';

export class StorageServiceProvider extends ServiceProvider {
  register() {
    this.app.singleton('storage', (app) => new StorageManager(app));
  }
}
