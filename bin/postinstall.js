#!/usr/bin/env node

import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const PACKAGE_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** Prisma on Windows can fail to rename query_engine while AV/indexers hold the file. */
const LOCK_ERROR = /\b(EPERM|EBUSY)\b/;

/**
 * npm sets INIT_CWD to where `npm install` was run. When TaandJs is installed as a
 * dependency of another project, that dir is outside this package — skip generate.
 */
export function shouldGenerate({ initCwd, packageDir }) {
  if (!initCwd) return true;
  const rel = path.relative(packageDir, initCwd);
  return rel === '' || (!rel.startsWith(`..${path.sep}`) && rel !== '..' && !path.isAbsolute(rel));
}

/** @returns {'done' | 'retry' | 'warn' | 'fail'} */
export function generateOutcome({ code, output, platform, attempt, maxAttempts }) {
  if (code === 0) return 'done';
  if (platform !== 'win32' || !LOCK_ERROR.test(output)) return 'fail';
  return attempt < maxAttempts ? 'retry' : 'warn';
}

function toBin(name) {
  if (process.platform === 'win32') return `${name}.cmd`;
  return name;
}

/** Runs prisma generate, streaming its output while keeping a copy for lock detection. */
function runNpxPrismaGenerate() {
  return new Promise((resolve, reject) => {
    const options = { stdio: ['inherit', 'pipe', 'pipe'] };
    const child =
      process.platform === 'win32'
        ? spawn('cmd.exe', ['/d', '/s', '/c', 'npx prisma generate --schema schema/schema.prisma'], options)
        : spawn(toBin('npx'), ['prisma', 'generate', '--schema', 'schema/schema.prisma'], options);

    let output = '';
    child.stdout.on('data', (chunk) => {
      output += chunk;
      process.stdout.write(chunk);
    });
    child.stderr.on('data', (chunk) => {
      output += chunk;
      process.stderr.write(chunk);
    });
    child.on('error', reject);
    child.on('close', (code) => resolve({ code: code ?? 1, output }));
  });
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  if (!shouldGenerate({ initCwd: process.env.INIT_CWD, packageDir: PACKAGE_DIR })) return;

  const maxAttempts = 3;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const { code, output } = await runNpxPrismaGenerate();
    const outcome = generateOutcome({ code, output, platform: process.platform, attempt, maxAttempts });

    if (outcome === 'done') return;
    if (outcome === 'retry') {
      await sleep(750 * attempt);
      continue;
    }

    if (outcome === 'warn') {
      console.warn('[Taand] Prisma generate failed during install.');
      console.warn('[Taand] This is commonly caused by Windows/antivirus locking Prisma engine files.');
      console.warn('[Taand] Fix: close any Node terminals, add AV exclusion for this folder, then run: npm run db:generate');
      // Don’t brick installs on Windows due to transient locks.
      process.exit(0);
    }

    process.exit(code);
  }
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  main().catch((err) => {
    console.warn('[Taand] postinstall failed:', err.message);
    process.exit(1);
  });
}
