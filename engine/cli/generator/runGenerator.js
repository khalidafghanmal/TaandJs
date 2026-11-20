import { parseArgv } from '../utils/parseArgv.js';
import { GeneratorEngine } from './GeneratorEngine.js';
import { MAKE_COMMAND_TO_GENERATOR } from './definitions.js';

export function isMakeCommand(commandName) {
  return commandName in MAKE_COMMAND_TO_GENERATOR;
}

/**
 * Fast generator entry — skips registry, app bootstrap, and heavy CLI boot.
 */
export function runMakeCommand(argv, { root = null } = {}) {
  const parsed = parseArgv(argv);
  const generatorId = MAKE_COMMAND_TO_GENERATOR[parsed.commandName];

  if (!generatorId) {
    process.stdout.write(`[Taand] Unknown generator command [${parsed.commandName}]\n`);
    process.exitCode = 1;
    return { ok: false };
  }

  if (parsed.command.help) {
    process.stdout.write(`[Taand] Usage: ${parsed.commandName} <name> [--force]\n`);
    return { ok: true };
  }

  return GeneratorEngine.run(generatorId, {
    positionals: parsed.positionals,
    flags: parsed.command.flags,
    root,
  });
}
