import { renderGlobalHelp } from '../../ui/help.js';

export class HelpCommand {
  name = 'help';
  description = 'Show help for a command';
  usage = 'help <command>';

  async run({ registry, positionals }) {
    const name = positionals[0] ?? null;
    process.stdout.write(renderGlobalHelp(registry, name));
  }
}

