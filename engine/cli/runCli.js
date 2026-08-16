import { createRegistry } from './registry.js';
import { renderGlobalHelp, renderUnknownCommand } from './ui/help.js';
import { parseArgv } from './utils/parseArgv.js';
import { isMakeCommand, runMakeCommand } from './generator/runGenerator.js';
import { tryDaemonDispatch } from './daemon/client.js';

export async function runCli(argv) {
  if (!argv || argv.length === 0) {
    const { createRegistry } = await import('./registry.js');
    const { renderGlobalHelp } = await import('./ui/help.js');
    process.stdout.write(renderGlobalHelp(createRegistry()));
    process.stdout.write(`
Tip: start the HTTP server with npm, not this CLI:
  npm run dev
  npm run build && npm start
`);
    return;
  }

  const parsed = parseArgv(argv);

  if (parsed.commandName === 'dev' || parsed.commandName === 'serve') {
    const tip =
      parsed.commandName === 'serve'
        ? '  npm run build\n  npm start'
        : '  npm run dev';
    console.error(`[Taand] Server start was removed from the CLI.
Use npm scripts instead:

${tip}
`);
    process.exitCode = 1;
    return;
  }

  if (isMakeCommand(parsed.commandName)) {
    const daemonResponse = await tryDaemonDispatch(argv);
    if (daemonResponse) {
      if (daemonResponse.stdout) process.stdout.write(daemonResponse.stdout);
      if (daemonResponse.stderr) process.stderr.write(daemonResponse.stderr);
      if (daemonResponse.exitCode) process.exitCode = daemonResponse.exitCode;
      return;
    }
    runMakeCommand(argv);
    return;
  }

  const registry = createRegistry();

  if (parsed.commandName === 'list') {
    process.stdout.write(renderGlobalHelp(registry));
    return;
  }

  if (parsed.global.help || parsed.commandName === 'help') {
    const cmd = parsed.commandName === 'help' ? parsed.positionals[0] : null;
    process.stdout.write(renderGlobalHelp(registry, cmd));
    return;
  }

  if (parsed.global.version || parsed.commandName === '--version' || parsed.commandName === '-v') {
    process.stdout.write(`${registry.meta.name} ${registry.meta.version}\n`);
    return;
  }

  const meta = registry.get(parsed.commandName);
  if (!meta) {
    process.stdout.write(renderUnknownCommand(registry, parsed.commandName));
    process.exitCode = 1;
    return;
  }

  if (parsed.command.help) {
    process.stdout.write(renderGlobalHelp(registry, parsed.commandName));
    return;
  }

  const command = await registry.load(parsed.commandName);
  if (!command) {
    process.stdout.write(renderUnknownCommand(registry, parsed.commandName));
    process.exitCode = 1;
    return;
  }

  await command.run({
    argv,
    positionals: parsed.positionals,
    options: parsed.command.options,
    flags: parsed.command.flags,
    registry,
  });
}
