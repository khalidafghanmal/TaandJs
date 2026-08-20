import { loadApp } from '../../utils/loadApp.js';

export class ScheduleRunCommand {
  name = 'schedule:run';
  description = 'Run all due scheduled tasks (call from cron every minute)';
  usage = 'schedule:run';
  examples = ['Taand schedule:run'];

  async run() {
    const app = await loadApp(import.meta.url);
    await app.bootstrap();

    const results = await app.make('schedule').runDue(new Date());

    if (results.length === 0) {
      process.stdout.write('[Taand] No scheduled tasks due.\n');
    } else {
      process.stdout.write(`[Taand] Ran ${results.length} scheduled task(s).\n`);
      for (const result of results) {
        process.stdout.write(`  → ${JSON.stringify(result)}\n`);
      }
    }

    if (app.has('redis')) await app.make('redis').disconnect();
    if (app.has('prisma')) await app.make('prisma').disconnect();
    if (app.has('log')) await app.make('log').flush();
  }
}
