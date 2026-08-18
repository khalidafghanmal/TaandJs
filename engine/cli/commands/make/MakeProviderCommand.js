import { GeneratorEngine } from '../../generator/GeneratorEngine.js';

export class MakeProviderCommand {
  name = 'make:provider';
  description = 'Create a new service provider';
  usage = 'make:provider <name> [--force]';
  options = [{ flag: '--force', description: 'Overwrite existing file' }];
  examples = ['Taand make:provider BillingServiceProvider'];

  run(ctx) {
    return GeneratorEngine.run('provider', ctx);
  }
}
