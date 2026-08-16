import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

let cachedMeta = null;

export function readPackageMeta() {
  if (cachedMeta) return cachedMeta;

  const pkgPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'package.json');
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  cachedMeta = { name: pkg.name ?? 'Taand', version: pkg.version ?? '0.0.0' };
  return cachedMeta;
}

/** Lightweight command metadata — no heavy imports until a command runs. */
export const COMMAND_MANIFEST = [
  { name: 'list', description: 'List available commands' },
  { name: 'help', description: 'Show help for a command', usage: 'help <command>' },
  // HTTP server: use npm run dev / npm start (not CLI)
  { name: 'route:list', description: 'List all registered routes', load: () => import('./commands/routing/RouteListCommand.js') },
  {
    name: 'queue:work',
    description: 'Run the queue worker',
    usage: 'queue:work [--queue=default] [--connection=database] [--sleep=1] [--once]',
    options: [
      { flag: '--queue=<name>', description: 'Queue name (default: default)' },
      { flag: '--connection=<name>', description: 'Queue connection (default: config default)' },
      { flag: '--sleep=<seconds>', description: 'Sleep time when queue is empty (default: 1)' },
      { flag: '--once', description: 'Process one job and exit' },
    ],
    examples: ['Taand queue:work --connection=database --queue=emails', 'Taand queue:work --once'],
    load: () => import('./commands/queue/QueueWorkCommand.js'),
  },
  { name: 'queue:failed', description: 'List failed queue jobs', load: () => import('./commands/queue/QueueFailedCommand.js') },
  { name: 'cache:clear', description: 'Clear application cache', load: () => import('./commands/cache/CacheClearCommand.js') },
  {
    name: 'schedule:run',
    description: 'Run due scheduled tasks (cron every minute)',
    usage: 'schedule:run',
    examples: ['Taand schedule:run'],
    load: () => import('./commands/schedule/ScheduleRunCommand.js'),
  },
  {
    name: 'schedule:list',
    description: 'List registered scheduled tasks',
    usage: 'schedule:list',
    load: () => import('./commands/schedule/ScheduleListCommand.js'),
  },
  {
    name: 'config:show',
    description: 'Show resolved config values',
    usage: 'config:show [key]',
    examples: ['Taand config:show', 'Taand config:show app.env', 'Taand config:show database'],
    load: () => import('./commands/config/ConfigShowCommand.js'),
  },
  { name: 'migrate', description: 'Run database migrations (Prisma)', usage: 'migrate', examples: ['Taand migrate'], load: () => import('./commands/db/MigrateCommand.js') },
  { name: 'db:push', description: 'Push Prisma schema to the database', load: () => import('./commands/db/DbPushCommand.js') },
  { name: 'db:studio', description: 'Open Prisma Studio', load: () => import('./commands/db/DbStudioCommand.js') },
  {
    name: 'db:seed',
    description: 'Seed the database with records',
    usage: 'db:seed [--class=DatabaseSeeder]',
    options: [{ flag: '--class=<name>', description: 'Seeder class (default: DatabaseSeeder)' }],
    examples: ['Taand db:seed', 'Taand db:seed --class=UserSeeder'],
    load: () => import('./commands/db/DbSeedCommand.js'),
  },
  {
    name: 'make:controller',
    description: 'Create a new controller class',
    bootMode: 'generator',
    usage: 'make:controller <name> [--force]',
    options: [{ flag: '--force', description: 'Overwrite existing file' }],
    examples: ['Taand make:controller UserController', 'Taand make:controller Admin/DashboardController'],
    load: () => import('./commands/make/MakeControllerCommand.js'),
  },
  {
    name: 'make:middleware',
    description: 'Create a new middleware class',
    bootMode: 'generator',
    usage: 'make:middleware <name> [--force]',
    options: [{ flag: '--force', description: 'Overwrite existing file' }],
    examples: ['Taand make:middleware AdminMiddleware'],
    load: () => import('./commands/make/MakeMiddlewareCommand.js'),
  },
  {
    name: 'make:provider',
    description: 'Create a new service provider',
    bootMode: 'generator',
    usage: 'make:provider <name> [--force]',
    options: [{ flag: '--force', description: 'Overwrite existing file' }],
    examples: ['Taand make:provider BillingServiceProvider'],
    load: () => import('./commands/make/MakeProviderCommand.js'),
  },
  {
    name: 'make:job',
    description: 'Create a new queue job',
    bootMode: 'generator',
    usage: 'make:job <name> [--force]',
    options: [{ flag: '--force', description: 'Overwrite existing file' }],
    examples: ['Taand make:job SendReceiptEmail'],
    load: () => import('./commands/make/MakeJobCommand.js'),
  },
  {
    name: 'make:event',
    description: 'Create a new event class',
    bootMode: 'generator',
    usage: 'make:event <name> [--force]',
    options: [{ flag: '--force', description: 'Overwrite existing file' }],
    examples: ['Taand make:event UserRegistered'],
    load: () => import('./commands/make/MakeEventCommand.js'),
  },
  {
    name: 'make:listener',
    description: 'Create a new event listener class',
    bootMode: 'generator',
    usage: 'make:listener <name> [--force]',
    options: [{ flag: '--force', description: 'Overwrite existing file' }],
    examples: ['Taand make:listener SendWelcomeEmail'],
    load: () => import('./commands/make/MakeListenerCommand.js'),
  },
  {
    name: 'make:mail',
    description: 'Create a new mailable class',
    bootMode: 'generator',
    usage: 'make:mail <name> [--force]',
    options: [{ flag: '--force', description: 'Overwrite existing file' }],
    examples: ['Taand make:mail WelcomeMail'],
    load: () => import('./commands/make/MakeMailCommand.js'),
  },
  {
    name: 'make:seeder',
    description: 'Create a new database seeder',
    bootMode: 'generator',
    usage: 'make:seeder <name> [--force]',
    options: [{ flag: '--force', description: 'Overwrite existing file' }],
    examples: ['Taand make:seeder UserSeeder', 'Taand make:seeder ProductSeeder'],
    load: () => import('./commands/make/MakeSeederCommand.js'),
  },
  {
    name: 'make:model',
    description: 'Create a Prisma model accessor',
    bootMode: 'generator',
    usage: 'make:model <name> [--force]',
    options: [{ flag: '--force', description: 'Overwrite existing file' }],
    examples: ['Taand make:model Product', 'Taand make:model OrderItem'],
    load: () => import('./commands/make/MakeModelCommand.js'),
  },
  {
    name: 'make:module',
    description: 'Scaffold a feature module (controller + routes stub)',
    bootMode: 'generator',
    usage: 'make:module <name> [--force]',
    options: [{ flag: '--force', description: 'Overwrite existing file' }],
    examples: ['Taand make:module Billing', 'Taand make:module Shop'],
    load: () => import('./commands/make/MakeModuleCommand.js'),
  },
  {
    name: 'daemon',
    description: 'Start CLI daemon worker (experimental)',
    usage: 'daemon',
    load: () => import('./commands/meta/DaemonCommand.js'),
  },
];
