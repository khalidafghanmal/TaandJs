import { loadApp } from '../../utils/loadApp.js';

export class ScheduleListCommand {
  name = 'schedule:list';
  description = 'List all registered scheduled tasks';
  usage = 'schedule:list';

  async run() {
    const app = await loadApp(import.meta.url);
    await app.bootstrap();

    const events = app.make('schedule').events();

    if (!events.length) {
      process.stdout.write('[Taand] No scheduled tasks registered. Edit app/schedule.js\n');
      return;
    }

    process.stdout.write('[Taand] Scheduled tasks:\n\n');
    for (const event of events) {
      const label = event.description || event.handler?.command || event.handler?.type || 'task';
      process.stdout.write(`  ${event.expression.padEnd(16)} ${label}\n`);
    }

    if (app.has('redis')) await app.make('redis').disconnect();
    if (app.has('prisma')) await app.make('prisma').disconnect();
    if (app.has('log')) await app.make('log').flush();
  }
}
