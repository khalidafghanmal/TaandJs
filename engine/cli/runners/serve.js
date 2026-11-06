import { loadApp, resolvetaandbasePath } from '../utils/loadApp.js';
import { loadEnv } from '../../core/Env.js';
import { ProductionServer } from '../../server/ProductionServer.js';

/**
 * The production server must not inherit dev defaults (debug overlay, /__Taand dashboards)
 * just because TAAND_ENV was left unset. Read .env first so an explicit value still wins.
 */
export function applyServeDefaults(basePath) {
  loadEnv(basePath);
  process.env.TAAND_ENV ??= 'production';
}

export async function runServe() {
  // Before loadApp: importing the app (Prisma's dotenv, user modules) may already read env.
  applyServeDefaults(resolvetaandbasePath(import.meta.url));
  const app = await loadApp(import.meta.url);
  let server = null;
  let shuttingDown = false;

  async function shutdown() {
    if (shuttingDown) return;
    shuttingDown = true;

    try {
      await server?.stop();

      if (app.has('prisma')) {
        await app.make('prisma').disconnect();
      }

      if (app.has('log')) {
        await app.make('log').flush();
      }

      process.exit(0);
    } catch (err) {
      console.error('[Taand]', err.message);
      process.exit(1);
    }
  }

  await app.bootstrap();

  server = new ProductionServer(app);
  await server.start();

  if (process.stdin.isTTY) {
    process.stdin.resume();
  }

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

