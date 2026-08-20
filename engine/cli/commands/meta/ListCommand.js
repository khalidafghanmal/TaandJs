import { renderGlobalHelp } from '../../ui/help.js';

export class ListCommand {
  name = 'list';
  description = 'List available commands';
  usage = 'list';

  async run({ registry }) {
    process.stdout.write(renderGlobalHelp(registry));
  }
}

