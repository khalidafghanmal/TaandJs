import { runDev } from '../../runners/dev.js';

export class DevCommand {
  name = 'dev';
  description = 'Start the development server (hot reload)';
  usage = 'dev';

  async run() {
    return runDev();
  }
}

