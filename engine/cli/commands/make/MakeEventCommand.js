import { GeneratorEngine } from '../../generator/GeneratorEngine.js';

export class MakeEventCommand {
  name = 'make:event';
  description = 'Create a new event class';
  usage = 'make:event <name> [--force]';
  options = [{ flag: '--force', description: 'Overwrite existing file' }];
  examples = ['Taand make:event UserRegistered'];

  run(ctx) {
    return GeneratorEngine.run('event', ctx);
  }
}
