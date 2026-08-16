#!/usr/bin/env node

/**
 * Taand CLI — generators, db, queue, schedule, … (not the HTTP server).
 * Start the app with: npm run dev | npm run build && npm start
 */

const argv = process.argv.slice(2);

function fail(err) {
  console.error('[Taand]', err.message);
  process.exit(1);
}

function refuseServerStart(kind) {
  const tip =
    kind === 'serve'
      ? '  npm run build\n  npm start'
      : '  npm run dev';

  console.error(`[Taand] Server start was removed from the CLI.
Use npm scripts instead:

${tip}
`);
  process.exit(1);
}

async function dispatchMake(argv) {
  const { tryDaemonDispatch } = await import('../engine/cli/daemon/client.js');
  const { runMakeCommand } = await import('../engine/cli/generator/runGenerator.js');

  const daemonResponse = await tryDaemonDispatch(argv);
  if (daemonResponse) {
    if (daemonResponse.stdout) process.stdout.write(daemonResponse.stdout);
    if (daemonResponse.stderr) process.stderr.write(daemonResponse.stderr);
    if (daemonResponse.exitCode) process.exitCode = daemonResponse.exitCode;
    return;
  }

  runMakeCommand(argv);
}

if (argv.length === 0) {
  const { createRegistry } = await import('../engine/cli/registry.js');
  const { renderGlobalHelp } = await import('../engine/cli/ui/help.js');
  process.stdout.write(renderGlobalHelp(createRegistry()));
  process.stdout.write(`
Tip: start the HTTP server with npm, not this CLI:
  npm run dev
  npm run build && npm start
`);
} else if (argv[0] === 'dev' || argv[0] === 'serve') {
  refuseServerStart(argv[0]);
} else if (argv[0]?.startsWith('make:')) {
  dispatchMake(argv).catch(fail);
} else if (argv[0] === 'list' && argv.length === 1) {
  const { createRegistry } = await import('../engine/cli/registry.js');
  const { renderGlobalHelp } = await import('../engine/cli/ui/help.js');
  process.stdout.write(renderGlobalHelp(createRegistry()));
} else if (argv[0] === '--version' || argv[0] === '-v') {
  const { readPackageMeta } = await import('../engine/cli/manifest.js');
  const meta = readPackageMeta();
  process.stdout.write(`${meta.name} ${meta.version}\n`);
} else if (argv[0] === 'help') {
  const { createRegistry } = await import('../engine/cli/registry.js');
  const { renderGlobalHelp } = await import('../engine/cli/ui/help.js');
  process.stdout.write(renderGlobalHelp(createRegistry(), argv[1] ?? null));
} else {
  const { runCli } = await import('../engine/cli/runCli.js');
  runCli(argv).catch(fail);
}
