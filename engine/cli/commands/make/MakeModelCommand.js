import { GeneratorEngine } from '../../generator/GeneratorEngine.js';

export class MakeModelCommand {
  name = 'make:model';
  description = 'Create a Prisma model accessor';
  usage = 'make:model <name> [--force]';
  options = [{ flag: '--force', description: 'Overwrite existing file' }];
  examples = ['Taand make:model Product', 'Taand make:model OrderItem'];

  run(ctx) {
    return GeneratorEngine.run('model', ctx);
  }
}
