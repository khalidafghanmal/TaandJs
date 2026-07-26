/**
 * Renders mail templates from ui/mail/.
 */
export class MailRenderer {
  constructor(app) {
    this.app = app;
  }

  async render(name, data = {}) {
    if (!this.app.has('view')) {
      throw new Error('[Taand] View engine required for mail templates');
    }

    const viewName = name.startsWith('mail.') ? name : `mail.${name}`;
    return this.app.make('view').render(viewName, {
      ...data,
      appName: this.app.make('config').get('app.name', 'TaandJs'),
    });
  }
}
