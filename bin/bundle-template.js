#!/usr/bin/env node

/**
 * Bundle Taand project into packages/create-taand/template for npm publish.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { shouldSkip } from '../packages/create-taand/lib/create-project.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const target = path.join(root, 'packages', 'create-taand', 'template');

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });

  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const from = path.join(src, entry.name);
    if (shouldSkip(path.relative(root, from), entry.isDirectory())) continue;

    const to = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copyDir(from, to);
    } else {
      fs.copyFileSync(from, to);
    }
  }
}

function sleep(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function removeWithRetry(dir) {
  for (let attempt = 1; attempt <= 5; attempt++) {
    try {
      fs.rmSync(dir, { recursive: true, force: true });
      return;
    } catch (err) {
      if (attempt === 5 || (err.code !== 'EBUSY' && err.code !== 'EPERM')) throw err;
      sleep(250 * attempt);
    }
  }
}

if (fs.existsSync(target)) {
  removeWithRetry(target);
}

copyDir(root, target);

console.log(`[bundle-template] Wrote ${target}`);
