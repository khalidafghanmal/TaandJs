import { loadApp } from '../../utils/loadApp.js';

export class CacheClearCommand {
  name = 'cache:clear';
  description = 'Clear application cache';
  usage = 'cache:clear';

  async run() {
    const app = await loadApp(import.meta.url);
    await app.bootstrap();

    if (!app.has('cache')) {
      process.stdout.write('[Taand] Cache manager not registered\n');
      process.exitCode = 1;
      return;
    }

    await app.make('cache').flush();
    process.stdout.write('[Taand] Cache cleared\n');

    if (app.has('prisma')) await app.make('prisma').disconnect();
    if (app.has('log')) await app.make('log').flush();
  }
}

