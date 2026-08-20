import { runServe } from '../../runners/serve.js';

export class ServeCommand {
  name = 'serve';
  description = 'Start the production server';
  usage = 'serve';

  async run() {
    return runServe();
  }
}

