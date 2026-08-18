import { GeneratorEngine } from '../../generator/GeneratorEngine.js';

export class MakeJobCommand {
  name = 'make:job';
  description = 'Create a new queue job';
  usage = 'make:job <name> [--force]';
  options = [{ flag: '--force', description: 'Overwrite existing file' }];
  examples = ['Taand make:job SendReceiptEmail'];

  run(ctx) {
    return GeneratorEngine.run('job', ctx);
  }
}
