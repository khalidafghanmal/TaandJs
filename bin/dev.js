#!/usr/bin/env node

import { runDev } from '../engine/cli/runners/dev.js';
import { cliErrorMessage } from '../engine/cli/utils/errorMessage.js';

runDev().catch((err) => {
  console.error(cliErrorMessage(err));
  process.exit(1);
});
