import { GeneratorEngine } from '../../generator/GeneratorEngine.js';

export class MakeControllerCommand {
  name = 'make:controller';
  description = 'Create a new controller class';
  usage = 'make:controller <name> [--force]';
  options = [{ flag: '--force', description: 'Overwrite existing file' }];
  examples = ['Taand make:controller UserController', 'Taand make:controller Admin/DashboardController'];

  run(ctx) {
    return GeneratorEngine.run('controller', ctx);
  }
}
