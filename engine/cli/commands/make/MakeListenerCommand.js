import { GeneratorEngine } from '../../generator/GeneratorEngine.js';

export class MakeListenerCommand {
  name = 'make:listener';
  description = 'Create a new event listener class';
  usage = 'make:listener <name> [--force]';
  options = [{ flag: '--force', description: 'Overwrite existing file' }];
  examples = ['Taand make:listener SendWelcomeEmail'];

  run(ctx) {
    return GeneratorEngine.run('listener', ctx);
  }
}
