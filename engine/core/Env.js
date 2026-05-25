import fs from 'node:fs';
import path from 'node:path';

/**
 * Loads .env into process.env — Taand's LoadEnvironmentVariables equivalent.
 * Does not override existing environment variables.
 */
export function loadEnv(basePath) {
  const envPath = path.join(basePath, '.env');

  if (!fs.existsSync(envPath)) return;

  const lines = fs.readFileSync(envPath, 'utf8').split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const eqIndex = trimmed.indexOf('=');
    if (eqIndex === -1) continue;

    const key = trimmed.slice(0, eqIndex).trim();
    let value = trimmed.slice(eqIndex + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

export function env(key, fallback = null) {
  const value = process.env[key];
  return value === undefined ? fallback : value;
}
