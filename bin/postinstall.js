#!/usr/bin/env node

import { spawn } from 'node:child_process';

function toBin(name) {
  if (process.platform === 'win32') return `${name}.cmd`;
  return name;
}

function runNpxPrismaGenerate() {
  return new Promise((resolve, reject) => {
    const child =
      process.platform === 'win32'
        ? spawn('cmd.exe', ['/d', '/s', '/c', 'npx prisma generate --schema schema/schema.prisma'], {
            stdio: 'inherit',
          })
        : spawn(toBin('npx'), ['prisma', 'generate', '--schema', 'schema/schema.prisma'], {
            stdio: 'inherit',
          });
    child.on('error', reject);
    child.on('exit', (code) => resolve(code ?? 1));
  });
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  const maxAttempts = 3;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const code = await runNpxPrismaGenerate();
    if (code === 0) return;

    // Prisma on Windows sometimes fails to rename query_engine due to AV/indexer locks.
    // Retry a few times, then allow install to proceed with clear instructions.
    if (process.platform === 'win32' && attempt < maxAttempts) {
      await sleep(750 * attempt);
      continue;
    }

    if (process.platform === 'win32') {
      console.warn('[Taand] Prisma generate failed during install.');
      console.warn('[Taand] This is commonly caused by Windows/antivirus locking Prisma engine files.');
      console.warn('[Taand] Fix: close any Node terminals, add AV exclusion for this folder, then run: npm run db:generate');
      // Don’t brick installs on Windows due to transient locks.
      process.exit(0);
    }

    process.exit(code);
  }
}

main().catch((err) => {
  console.warn('[Taand] postinstall failed:', err.message);
  if (process.platform === 'win32') process.exit(0);
  process.exit(1);
});

