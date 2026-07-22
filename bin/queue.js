#!/usr/bin/env node

import { runQueueFailed, runQueueWork } from '../engine/cli/runners/queue.js';

const argv = process.argv.slice(2);
const sub = argv[0] ?? 'work';
const rest = argv.slice(1);

async function main() {
  if (sub === 'work') return runQueueWork(rest);
  if (sub === 'failed') return runQueueFailed();

  console.log('Usage: node bin/queue.js work [--queue=default] [--connection=database] [--sleep=1] [--once]');
  console.log('       node bin/queue.js failed');
  process.exit(1);
}

main().catch((err) => {
  console.error('[Taand]', err.message);
  process.exit(1);
});
