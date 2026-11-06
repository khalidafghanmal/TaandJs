#!/usr/bin/env node

import fs from 'node:fs/promises';
import { realpathSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const dist = path.join(root, 'dist');

export const COPY_DIRS = [
  'start',
  'settings',
  'flow',
  'src',
  'records',
  'engine',
  'web',
  'ui',
  'schema',
];

const COPY_FILES = ['.env', '.env.example'];

const CLEAN_TARGETS = ['serve.js', 'queue.js', 'package.json', ...COPY_DIRS];

async function clean() {
  await fs.mkdir(dist, { recursive: true });

  for (const item of CLEAN_TARGETS) {
    const target = path.join(dist, item);
    try {
      await fs.rm(target, { recursive: true, force: true });
    } catch (err) {
      if (err.code === 'ENOENT') continue;
      if (err.code === 'EBUSY' || err.code === 'EPERM') {
        throw new Error(
          `${err.message}\n[Taand] Stop the production server (Ctrl+C) and retry npm run build`,
        );
      }
      throw err;
    }
  }
}

async function writeServeEntry() {
  const content = `#!/usr/bin/env node

import path from 'node:path';
import { fileURLToPath } from 'node:url';

process.env.TAAND_BASE_PATH = path.dirname(fileURLToPath(import.meta.url));

const { runServe } = await import('./engine/cli/runners/serve.js');

runServe().catch((err) => {
  console.error('[Taand]', err.message);
  process.exit(1);
});
`;

  await fs.writeFile(path.join(dist, 'serve.js'), content);
}

async function writeQueueEntry() {
  const content = `#!/usr/bin/env node

import path from 'node:path';
import { fileURLToPath } from 'node:url';

process.env.TAAND_BASE_PATH = path.dirname(fileURLToPath(import.meta.url));

const { runQueueFailed, runQueueWork } = await import('./engine/cli/runners/queue.js');

const argv = process.argv.slice(2);
const sub = argv[0] ?? 'work';
const rest = argv.slice(1);

async function main() {
  if (sub === 'work') return runQueueWork(rest);
  if (sub === 'failed') return runQueueFailed();

  console.log('Usage: node queue.js work [--queue=default] [--connection=database] [--sleep=1] [--once]');
  console.log('       node queue.js failed');
  process.exit(1);
}

main().catch((err) => {
  console.error('[Taand]', err.message);
  process.exit(1);
});
`;

  await fs.writeFile(path.join(dist, 'queue.js'), content);
}

async function copyRuntime() {
  for (const dir of COPY_DIRS) {
    const from = path.join(root, dir);
    const to = path.join(dist, dir);
    try {
      await fs.cp(from, to, { recursive: true });
    } catch (err) {
      if (err.code !== 'ENOENT') throw err;
    }
  }

  for (const file of COPY_FILES) {
    const from = path.join(root, file);
    try {
      await fs.copyFile(from, path.join(dist, file));
    } catch (err) {
      if (err.code !== 'ENOENT') throw err;
    }
  }

  await fs.mkdir(path.join(dist, 'storage', 'database'), { recursive: true });
  await fs.mkdir(path.join(dist, 'storage', 'logs'), { recursive: true });
  await fs.mkdir(path.join(dist, 'storage', 'cache', 'data'), { recursive: true });
  await fs.mkdir(path.join(dist, 'storage', 'uploads'), { recursive: true });
}

export function productionPackageJson(pkg) {
  return {
    name: pkg.name,
    version: pkg.version,
    type: 'module',
    private: true,
    engines: pkg.engines,
    scripts: {
      start: 'node serve.js',
      'queue:work': 'node queue.js work',
    },
    dependencies: pkg.dependencies,
  };
}

async function writePackageJson() {
  const pkg = JSON.parse(await fs.readFile(path.join(root, 'package.json'), 'utf8'));
  const production = productionPackageJson(pkg);

  await fs.writeFile(path.join(dist, 'package.json'), `${JSON.stringify(production, null, 2)}\n`);
}

async function main() {
  console.log('[Taand] Building production bundle...');

  await clean();
  await copyRuntime();
  await writeServeEntry();
  await writeQueueEntry();
  await writePackageJson();

  console.log('[Taand] Build complete → dist/');
  console.log('[Taand] Deploy: cd dist && npm install && npx prisma generate --schema schema/schema.prisma && npm start');
  console.log('[Taand] Or locally: npm run start');
}

const isMain = process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url));
if (isMain) {
  main().catch((err) => {
    console.error('[Taand] Build failed:', err.message);
    process.exit(1);
  });
}
