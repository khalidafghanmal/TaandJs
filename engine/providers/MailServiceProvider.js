import { ServiceProvider } from '../core/ServiceProvider.js';
import { MailManager } from '../mail/MailManager.js';
import { MailRenderer } from '../mail/MailRenderer.js';
import { MailDashboard } from '../mail/MailDashboard.js';

export class MailServiceProvider extends ServiceProvider {
  register() {
    this.app.singleton('mail', (app) => new MailManager(app));
    this.app.singleton('mail.renderer', (app) => new MailRenderer(app));
  }

  boot() {
    this.#registerDashboard();
  }

  #registerDashboard() {
    const env = this.app.make('config').get('app.env', 'local');
    if (!this.app.debug || env !== 'local') return;

    const route = this.app.make('route');
    route.get('/__Taand/mail', async (req) => MailDashboard.index(this.app, req));
    route.get('/__Taand/mail/preview/:id', async (req) => MailDashboard.preview(this.app, req));
  }
}
