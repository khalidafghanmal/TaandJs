#!/usr/bin/env node

import { runServe } from '../engine/cli/runners/serve.js';
import { cliErrorMessage } from '../engine/cli/utils/errorMessage.js';

runServe().catch((err) => {
  console.error(cliErrorMessage(err));
  process.exit(1);
});
