import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import {
  listModuleNames,
  moduleSlug,
  resolveModuleControllerFile,
  resolveModuleViewFile,
  assertModuleName,
} from '../engine/modules/ModulePaths.js';
import { ViewFinder } from '../engine/view/ViewFinder.js';
import { ControllerDispatcher } from '../engine/routing/ControllerDispatcher.js';
import { GeneratorEngine } from '../engine/cli/generator/GeneratorEngine.js';
import { req } from './helpers/setup.js';

async function withTempApp(fn) {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'taand-mod-'));
  try {
    await fs.mkdir(path.join(tmp, 'src', 'features', 'Billing', 'ui'), { recursive: true });
    await fs.mkdir(path.join(tmp, 'src', 'actions'), { recursive: true });
    await fs.mkdir(path.join(tmp, 'ui'), { recursive: true });
    await fn(tmp);
  } finally {
    await fs.rm(tmp, { recursive: true, force: true });
  }
}

test('assertModuleName rejects unsafe names', () => {
  assert.doesNotThrow(() => assertModuleName('Billing'));
  assert.throws(() => assertModuleName('../evil'));
  assert.throws(() => assertModuleName('billing'));
});

test('listModuleNames ignores invalid directories', async () => {
  await withTempApp(async (tmp) => {
    await fs.mkdir(path.join(tmp, 'src', 'features', 'bad-name'), { recursive: true });
    const names = listModuleNames(tmp);
    assert.deepEqual(names, ['Billing']);
  });
});

test('moduleSlug maps PascalCase to camelCase slug', () => {
  assert.equal(moduleSlug('Billing'), 'billing');
  assert.equal(moduleSlug('ShopApi'), 'shopApi');
});

test('resolveModuleViewFile finds module views', async () => {
  await withTempApp(async (tmp) => {
    const viewFile = path.join(tmp, 'src', 'features', 'Billing', 'ui', 'index.taand');
    await fs.writeFile(viewFile, '<html></html>', 'utf8');

    const resolved = resolveModuleViewFile(tmp, 'billing.index');
    assert.equal(resolved, path.resolve(viewFile));

    assert.equal(resolveModuleViewFile(tmp, 'main'), null);
    assert.equal(resolveModuleViewFile(tmp, 'billing.missing'), null);
  });
});

test('ViewFinder resolves module views before global views', async () => {
  await withTempApp(async (tmp) => {
    const globalMain = path.join(tmp, 'ui', 'billing.taand');
    const moduleIndex = path.join(tmp, 'src', 'features', 'Billing', 'ui', 'index.taand');
    await fs.writeFile(globalMain, 'global', 'utf8');
    await fs.writeFile(moduleIndex, 'module', 'utf8');

    const finder = new ViewFinder(path.join(tmp, 'ui'), { basePath: tmp });
    assert.equal(finder.find('billing.index'), path.resolve(moduleIndex));
    assert.equal(finder.find('billing'), path.resolve(globalMain));
  });
});

test('resolveModuleControllerFile finds unique module controller', async () => {
  await withTempApp(async (tmp) => {
    const controller = path.join(tmp, 'src', 'features', 'Billing', 'BillingController.js');
    await fs.writeFile(
      controller,
      `export class BillingController { index() { return 'ok'; } }\nexport default BillingController;\n`,
      'utf8',
    );

    const file = resolveModuleControllerFile(tmp, 'BillingController');
    assert.equal(file, path.resolve(controller));
    assert.equal(resolveModuleControllerFile(tmp, 'MissingController'), null);
  });
});

test('resolveModuleControllerFile throws on ambiguous duplicate', async () => {
  await withTempApp(async (tmp) => {
    await fs.mkdir(path.join(tmp, 'src', 'features', 'Shop'), { recursive: true });
    const body = `export default class SharedController {}\n`;
    await fs.writeFile(path.join(tmp, 'src', 'features', 'Billing', 'SharedController.js'), body);
    await fs.writeFile(path.join(tmp, 'src', 'features', 'Shop', 'SharedController.js'), body);

    assert.throws(() => resolveModuleControllerFile(tmp, 'SharedController'), /Ambiguous controller/);
  });
});

test('ControllerDispatcher prefers src/actions over modules', async () => {
  await withTempApp(async (tmp) => {
    await fs.writeFile(
      path.join(tmp, 'src', 'actions', 'DemoController.js'),
      `export class DemoController { ping() { return { from: 'global' }; } }\nexport default DemoController;\n`,
      'utf8',
    );
    await fs.writeFile(
      path.join(tmp, 'src', 'features', 'Billing', 'DemoController.js'),
      `export class DemoController { ping() { return { from: 'module' }; } }\nexport default DemoController;\n`,
      'utf8',
    );

    const app = { basePath: tmp, make() { throw new Error('unused'); } };
    const dispatcher = new ControllerDispatcher(app);
    const handler = await dispatcher.resolve('DemoController@ping');
    const result = await handler(req('/ping'));
    assert.equal(result.from, 'global');
  });
});

test('ControllerDispatcher resolves module-only controller', async () => {
  await withTempApp(async (tmp) => {
    await fs.writeFile(
      path.join(tmp, 'src', 'features', 'Billing', 'BillingController.js'),
      `export class BillingController { show() { return { ok: true }; } }\nexport default BillingController;\n`,
      'utf8',
    );

    const app = { basePath: tmp, make() { throw new Error('unused'); } };
    const dispatcher = new ControllerDispatcher(app);
    const handler = await dispatcher.resolve('BillingController@show');
    assert.deepEqual(await handler(req('/billing')), { ok: true });
  });
});

test('GeneratorEngine creates full module scaffold with views', async () => {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'taand-cli-mod2-'));
  const before = process.cwd();
  process.chdir(tmp);
  try {
    await fs.mkdir(path.join(tmp, 'start'), { recursive: true });
    await fs.writeFile(path.join(tmp, 'start', 'app.js'), 'export {};\n', 'utf8');
    await fs.writeFile(path.join(tmp, 'package.json'), '{"name":"tmp"}\n', 'utf8');

    GeneratorEngine.run('module', {
      positionals: ['Billing'],
      flags: new Set(['force']),
      root: tmp,
    });

    const view = path.join(tmp, 'src', 'features', 'Billing', 'ui', 'index.taand');
    assert.match(await fs.readFile(view, 'utf8'), /\{\{ module \}\} module/);
    assert.match(await fs.readFile(path.join(tmp, 'src', 'features', 'Billing', 'routes.js'), 'utf8'), /prefix: '\/billing'/);
  } finally {
    process.chdir(before);
    await fs.rm(tmp, { recursive: true, force: true });
  }
});
