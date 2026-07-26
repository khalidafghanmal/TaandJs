/**
 * Logs mail via the logging system.
 */
export class LogDriver {
  constructor(app) {
    this.app = app;
  }

  async send(message, raw) {
    if (this.app.has('log')) {
      this.app.make('log').info('Mail sent (log driver)', {
        to: message.to.map((a) => a.email),
        subject: message.subject,
        preview: (message.text ?? message.html ?? '').slice(0, 200),
      });
      await this.app.make('log').flush?.();
    }

    return { id: `log_${Date.now()}`, driver: 'log' };
  }
}
