#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createProject } from '../packages/create-taand/lib/create-project.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function main() {
  const args = process.argv.slice(2).filter((a) => a !== '--');
  const noInstall = args.includes('--no-install');
  const name = args.find((a) => !a.startsWith('--')) ?? 'my-taand-app';

  await createProject(name, {
    templateRoot: path.resolve(__dirname, '..'),
    install: !noInstall,
  });
}

const isMain = process.argv[1] && fs.realpathSync(process.argv[1]) === fs.realpathSync(fileURLToPath(import.meta.url));
if (isMain) {
  main().catch((err) => {
    console.error('[create-taand]', err.message);
    process.exit(1);
  });
}

export { createProject };
