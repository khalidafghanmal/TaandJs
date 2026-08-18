import { GeneratorEngine } from '../../generator/GeneratorEngine.js';

export class MakeModuleCommand {
  name = 'make:module';
  description = 'Scaffold a feature module (controller + routes stub)';
  usage = 'make:module <name> [--force]';
  options = [{ flag: '--force', description: 'Overwrite existing file' }];
  examples = ['Taand make:module Billing', 'Taand make:module Shop'];

  run(ctx) {
    return GeneratorEngine.run('module', ctx);
  }
}
