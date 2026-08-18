import { GeneratorEngine } from '../../generator/GeneratorEngine.js';

export class MakeMailCommand {
  name = 'make:mail';
  description = 'Create a new mailable class';
  usage = 'make:mail <name> [--force]';
  options = [{ flag: '--force', description: 'Overwrite existing file' }];
  examples = ['Taand make:mail WelcomeMail'];

  run(ctx) {
    return GeneratorEngine.run('mail', ctx);
  }
}
