import { ServiceProvider } from '../core/ServiceProvider.js';
import { QueueManager } from '../queue/QueueManager.js';
import { FailedJobRepository } from '../queue/FailedJobRepository.js';
import { QueueDashboard } from '../queue/QueueDashboard.js';

export class QueueServiceProvider extends ServiceProvider {
  register() {
    this.app.singleton('queue', (app) => new QueueManager(app));
    this.app.singleton('queue.failed', (app) => new FailedJobRepository(app));
  }

  boot() {
    this.#registerDashboard();
  }

  #registerDashboard() {
    const env = this.app.make('config').get('app.env', 'local');
    if (!this.app.debug || env !== 'local') return;

    const route = this.app.make('route');
    route.get('/__Taand/queue', async (req) => QueueDashboard.index(this.app, req));
    route.get('/__Taand/queue/retry/:uuid', async (req) => QueueDashboard.retry(this.app, req));
  }
}
