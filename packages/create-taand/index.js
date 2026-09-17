#!/usr/bin/env node

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createProject } from './lib/create-project.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const args = process.argv.slice(2).filter((a) => a !== '--');
const noInstall = args.includes('--no-install');
const name = args.find((a) => !a.startsWith('--')) ?? 'my-taand-app';

import fs from 'node:fs/promises';

const bundled = path.join(__dirname, 'template');
const monorepoRoot = path.resolve(__dirname, '../..');

let templateRoot = bundled;
try {
  await fs.access(path.join(bundled, 'package.json'));
} catch {
  templateRoot = monorepoRoot;
}

createProject(name, {
  templateRoot,
  install: !noInstall,
}).catch((err) => {
  console.error('[create-taand]', err.message);
  process.exit(1);
});
