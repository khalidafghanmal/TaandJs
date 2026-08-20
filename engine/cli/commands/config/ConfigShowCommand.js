import { resolveProjectRoot } from '../../../server/resolveRoot.js';
import { loadConfigCached, getConfigValue } from '../../cache/ConfigCache.js';

export class ConfigShowCommand {
  name = 'config:show';
  description = 'Show resolved settings values';
  usage = 'config:show [key]';
  examples = ['Taand config:show', 'Taand config:show runtime.env', 'Taand config:show data.primary'];

  async run({ positionals }) {
    const basePath = resolveProjectRoot(import.meta.url);
    const key = positionals[0] ?? null;
    const config = await loadConfigCached(basePath);

    if (!key) {
      process.stdout.write(`${JSON.stringify(config, null, 2)}\n`);
      return;
    }

    const value = getConfigValue(config, key);
    process.stdout.write(`${JSON.stringify(value ?? null, null, 2)}\n`);
  }
}
