import { getProjectRoot } from '../../utils/project.js';
import { loadApp } from '../../utils/loadApp.js';
import { runDatabaseSeed } from '../../../database/SeederRunner.js';

export class DbSeedCommand {
  name = 'db:seed';
  description = 'Seed the database with records';
  usage = 'db:seed [--class=DatabaseSeeder]';
  options = [{ flag: '--class=<name>', description: 'Seeder class name (default: DatabaseSeeder)' }];
  examples = ['Taand db:seed', 'Taand db:seed --class=UserSeeder'];

  async run({ command }) {
    const className = command.options.class ?? 'DatabaseSeeder';
    const app = await loadApp();
    await runDatabaseSeed(app, { className });
    process.stdout.write(`[Taand] Seeded: ${className}\n`);
  }
}
