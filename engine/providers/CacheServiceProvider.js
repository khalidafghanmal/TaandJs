import { ServiceProvider } from '../core/ServiceProvider.js';
import { CacheManager } from '../cache/CacheManager.js';
import { CacheDashboard } from '../cache/CacheDashboard.js';

export class CacheServiceProvider extends ServiceProvider {
  register() {
    this.app.singleton('cache', (app) => new CacheManager(app));
  }

  boot() {
    this.#registerDashboard();
  }

  #registerDashboard() {
    const env = this.app.make('config').get('app.env', 'local');
    if (!this.app.debug || env !== 'local') return;

    const route = this.app.make('route');

    route.get('/__Taand/cache', async (req) => CacheDashboard.index(this.app, req));
    route.get('/__Taand/cache/flush', async (req) => CacheDashboard.flush(this.app, req));
  }
}
