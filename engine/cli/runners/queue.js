import { loadApp } from '../utils/loadApp.js';

function parseArgs(argv) {
  const args = argv.slice();
  const flags = new Set();
  const options = {};
  const positionals = [];

  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a.startsWith('--')) {
      const eq = a.indexOf('=');
      if (eq !== -1) {
        const key = a.slice(2, eq);
        const value = a.slice(eq + 1);
        options[key] = value;
      } else {
        const key = a.slice(2);
        const next = args[i + 1];
        if (next && !next.startsWith('-')) {
          options[key] = next;
          i++;
        } else {
          flags.add(key);
        }
      }
      continue;
    }
    positionals.push(a);
  }

  return { positionals, options, flags };
}

export async function runQueueWork(argv = []) {
  const app = await loadApp(import.meta.url);
  const { options, flags } = parseArgs(argv);
  const queueName = options.queue ?? 'default';
  const connection = options.connection ?? null;
  const sleep = Number(options.sleep ?? '1');
  const once = flags.has('once');

  await app.bootstrap();

  console.log(`[Taand] Queue worker · connection=${connection ?? 'default'} queue=${queueName}`);

  const worker = app.make('queue').worker();
  process.on('SIGINT', () => {
    console.log('\n[Taand] Stopping worker...');
    worker.stop();
  });

  await worker.work(connection, {
    queue: queueName,
    sleep,
    maxJobs: once ? 1 : 0,
  });

  if (app.has('prisma')) await app.make('prisma').disconnect();
  if (app.has('log')) await app.make('log').flush();
  process.exit(0);
}

export async function runQueueFailed() {
  const app = await loadApp(import.meta.url);
  await app.bootstrap();

  const failed = await app.make('queue.failed').all(20);
  for (const job of failed) {
    console.log(`${job.uuid}  ${job.queue}  ${job.failedAt}`);
  }

  if (app.has('prisma')) await app.make('prisma').disconnect();
  if (app.has('log')) await app.make('log').flush();
  process.exit(0);
}

