#!/usr/bin/env node

import { runDev } from '../engine/cli/runners/dev.js';

runDev().catch((err) => {
  console.error('[Taand]', err.message);
  process.exit(1);
});
