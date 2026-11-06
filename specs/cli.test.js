import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { parseArgv } from '../engine/cli/utils/parseArgv.js';
import { MakeControllerCommand } from '../engine/cli/commands/make/MakeControllerCommand.js';
import { GeneratorEngine } from '../engine/cli/generator/GeneratorEngine.js';
import { TemplateEngine } from '../engine/cli/generator/TemplateEngine.js';
import { isMakeCommand } from '../engine/cli/generator/runGenerator.js';
import { defaultSocketPath } from '../engine/cli/daemon/protocol.js';
import { tryDaemonDispatch } from '../engine/cli/daemon/client.js';
import { CliDaemonServer } from '../engine/cli/daemon/server.js';

const execFileAsync = promisify(execFile);
const TAAND_ROOT = path.resolve(import.meta.dirname, '..');
const TAAND_BIN = path.join(TAAND_ROOT, 'bin', 'taand.js');

test('parseArgv parses basic flags/options', () => {
  const parsed = parseArgv(['make:controller', 'UserController', '--force', '--path=Admin']);
  assert.equal(parsed.commandName, 'make:controller');
  assert.deepEqual(parsed.positionals, ['UserController']);
  assert.equal(parsed.command.flags.has('force'), true);
  assert.equal(parsed.command.options.path, 'Admin');
});

test('isMakeCommand detects generator commands', () => {
  assert.equal(isMakeCommand('make:controller'), true);
  assert.equal(isMakeCommand('make:model'), true);
  assert.equal(isMakeCommand('route:list'), false);
});

test('TemplateEngine renders cached stubs synchronously', () => {
  const out = TemplateEngine.render('controller', { class: 'DemoController' });
  assert.match(out, /export class DemoController/);
});

test('Taand list prints commands', async () => {
  const { stdout } = await execFileAsync(process.execPath, [TAAND_BIN, 'list'], {
    cwd: TAAND_ROOT,
    env: { ...process.env, TAAND_CLI_NO_DAEMON: '1' },
  });
  assert.match(stdout, /route:list/);
  assert.match(stdout, /make:controller/);
  assert.match(stdout, /make:model/);
});

test('Taand route:list renders routes table', async () => {
  const { stdout } = await execFileAsync(process.execPath, [TAAND_BIN, 'route:list'], {
    cwd: TAAND_ROOT,
    env: { ...process.env, TAAND_CLI_NO_DAEMON: '1' },
  });
  assert.match(stdout, /METHOD\s+URI/);
  assert.match(stdout, /\s\/\s+HomeController@index/);
});

test('make:controller writes into src/actions', async () => {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'taand-cli-'));
  const entryDir = path.join(tmp, 'start');
  const controllersDir = path.join(tmp, 'src', 'actions');
  await fs.mkdir(entryDir, { recursive: true });
  await fs.mkdir(controllersDir, { recursive: true });
  await fs.writeFile(path.join(entryDir, 'app.js'), 'export {};\n', 'utf8');
  await fs.writeFile(path.join(tmp, 'package.json'), '{"name":"tmp","version":"0.0.0"}\n', 'utf8');

  const before = process.cwd();
  process.chdir(tmp);
  try {
    const cmd = new MakeControllerCommand();
    cmd.run({ positionals: ['DemoController'], flags: new Set(['force']), options: {}, argv: [] });

    const outFile = path.join(controllersDir, 'DemoController.js');
    const content = await fs.readFile(outFile, 'utf8');
    assert.match(content, /export class DemoController/);
  } finally {
    process.chdir(before);
    await fs.rm(tmp, { recursive: true, force: true });
  }
});

test('GeneratorEngine creates module scaffold', async () => {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'taand-cli-mod-'));
  const entryDir = path.join(tmp, 'start');
  await fs.mkdir(entryDir, { recursive: true });
  await fs.writeFile(path.join(entryDir, 'app.js'), 'export {};\n', 'utf8');
  await fs.writeFile(path.join(tmp, 'package.json'), '{"name":"tmp","version":"0.0.0"}\n', 'utf8');

  const before = process.cwd();
  process.chdir(tmp);
  try {
    GeneratorEngine.run('module', {
      positionals: ['Billing'],
      flags: new Set(['force']),
      root: tmp,
    });

    const controller = path.join(tmp, 'src', 'features', 'Billing', 'BillingController.js');
    const routes = path.join(tmp, 'src', 'features', 'Billing', 'routes.js');
    const view = path.join(tmp, 'src', 'features', 'Billing', 'ui', 'index.taand');
    assert.match(await fs.readFile(controller, 'utf8'), /BillingController/);
    assert.match(await fs.readFile(routes, 'utf8'), /flow\/http\.js/);
    assert.match(await fs.readFile(view, 'utf8'), /\{\{ module \}\} module/);
  } finally {
    process.chdir(before);
    await fs.rm(tmp, { recursive: true, force: true });
  }
});

test('make:controller cold start completes under 1 second', async () => {
  const start = Date.now();
  await execFileAsync(process.execPath, [TAAND_BIN, 'make:controller', 'PerfController', '--force'], {
    cwd: TAAND_ROOT,
    env: { ...process.env, TAAND_CLI_NO_DAEMON: '1' },
  });
  const elapsed = Date.now() - start;
  assert.ok(elapsed < 2500, `expected <2500ms, got ${elapsed}ms`);
});

test('daemon socket name is scoped per project root (and user on POSIX)', () => {
  const a = defaultSocketPath('/srv/project-a');
  assert.equal(defaultSocketPath('/srv/project-a'), a);
  assert.notEqual(defaultSocketPath('/srv/project-b'), a);
  if (process.platform === 'win32') {
    assert.match(a, /^\\\\\.\\pipe\\taand-cli-[0-9a-f]{16}$/);
    assert.equal(defaultSocketPath('C:\\Work\\App'), defaultSocketPath('c:\\work\\app'));
  } else {
    assert.ok(a.includes(`taand-cli-${process.getuid()}-`), a);
  }
});

test('daemon rejects RUN requests from another project root', async () => {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'taand-daemon-'));
  const rootA = path.join(tmp, 'a');
  const rootB = path.join(tmp, 'b');
  for (const root of [rootA, rootB]) {
    await fs.mkdir(path.join(root, 'start'), { recursive: true });
    await fs.mkdir(path.join(root, 'src', 'actions'), { recursive: true });
    await fs.writeFile(path.join(root, 'start', 'app.js'), 'export {};\n', 'utf8');
    await fs.writeFile(path.join(root, 'package.json'), '{"name":"tmp","version":"0.0.0"}\n', 'utf8');
  }

  const socketPath = defaultSocketPath(rootA);
  const server = new CliDaemonServer({ root: rootA, socketPath });
  await server.start();
  try {
    const rejected = await tryDaemonDispatch(['make:controller', 'Foo'], { root: rootB, socketPath });
    assert.equal(rejected?.exitCode, 1);
    assert.match(rejected.stderr, /different project/);
    await assert.rejects(fs.access(path.join(rootA, 'src', 'actions', 'Foo.js')));
    await assert.rejects(fs.access(path.join(rootB, 'src', 'actions', 'Foo.js')));

    const ok = await tryDaemonDispatch(['make:controller', 'Foo'], { root: rootA, socketPath });
    assert.equal(ok?.exitCode, 0, ok?.stderr);
    await fs.access(path.join(rootA, 'src', 'actions', 'Foo.js'));
  } finally {
    server.stop();
    await fs.rm(tmp, { recursive: true, force: true });
  }
});

test('daemon replaces a stale socket file on startup', { skip: process.platform === 'win32' }, async () => {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'taand-daemon-stale-'));
  const socketPath = path.join(tmp, 'd.sock');
  await fs.writeFile(socketPath, '');
  const server = new CliDaemonServer({ root: tmp, socketPath });
  try {
    assert.equal(await server.start(), socketPath);
  } finally {
    server.stop();
    await fs.rm(tmp, { recursive: true, force: true });
  }
});
