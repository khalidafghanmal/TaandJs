import { GeneratorEngine } from '../../generator/GeneratorEngine.js';

export class MakeSeederCommand {
  name = 'make:seeder';
  description = 'Create a new database seeder';
  usage = 'make:seeder <name> [--force]';
  options = [{ flag: '--force', description: 'Overwrite existing file' }];
  examples = ['Taand make:seeder UserSeeder', 'Taand make:seeder ProductSeeder'];

  run(ctx) {
    return GeneratorEngine.run('seeder', ctx);
  }
}
