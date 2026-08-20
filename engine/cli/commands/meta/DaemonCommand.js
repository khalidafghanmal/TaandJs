import { CliDaemonServer } from '../daemon/server.js';

export class DaemonCommand {
  name = 'daemon';
  description = 'Start CLI daemon worker (experimental — preloads generators)';
  usage = 'daemon';

  async run() {
    const server = new CliDaemonServer();
    const socketPath = await server.start();
    process.stdout.write(`[Taand] CLI daemon listening on ${socketPath}\n`);
    process.stdout.write('[Taand] Set TAAND_CLI_NO_DAEMON=1 to bypass daemon dispatch\n');
  }
}
