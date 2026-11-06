import { loadApp } from '../utils/loadApp.js';
import { DevServer } from '../../server/DevServer.js';
import { DevConsole } from '../../server/DevConsole.js';
import { cliErrorMessage } from '../utils/errorMessage.js';

export async function runDev() {
  const app = await loadApp(import.meta.url);
  let server = null;
  let shuttingDown = false;

  async function shutdown() {
    if (shuttingDown) return;
    shuttingDown = true;

    DevConsole.printStopping();

    try {
      await server?.stop();

      if (app.has('prisma')) {
        await app.make('prisma').disconnect();
      }

      if (app.has('log')) {
        await app.make('log').flush();
      }

      DevConsole.printStopped();
      process.exit(0);
    } catch (err) {
      console.error(cliErrorMessage(err));
      process.exit(1);
    }
  }

  await app.bootstrap();

  server = new DevServer(app);
  await server.start();

  if (process.stdin.isTTY) {
    process.stdin.resume();
  }

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

