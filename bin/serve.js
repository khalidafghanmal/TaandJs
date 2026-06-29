#!/usr/bin/env node

import { runServe } from '../engine/cli/runners/serve.js';

runServe().catch((err) => {
  console.error('[Taand]', err.message);
  process.exit(1);
});
