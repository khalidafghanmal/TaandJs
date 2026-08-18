import { GeneratorEngine } from '../../generator/GeneratorEngine.js';

export class MakeMiddlewareCommand {
  name = 'make:middleware';
  description = 'Create a new middleware class';
  usage = 'make:middleware <name> [--force]';
  options = [{ flag: '--force', description: 'Overwrite existing file' }];
  examples = ['Taand make:middleware AdminMiddleware'];

  run(ctx) {
    return GeneratorEngine.run('middleware', ctx);
  }
}
