import fs from 'node:fs';
import path from 'node:path';

/**
 * Resolves log paths safely — blocks path traversal outside storage/logs.
 */
export function resolveLogPath(basePath, relativePath, logsDir = 'storage/logs') {
  const allowedRoot = path.resolve(basePath, logsDir);
  const resolved = path.resolve(basePath, relativePath);
  const normalized = path.normalize(resolved);

  if (!normalized.startsWith(allowedRoot + path.sep) && normalized !== allowedRoot) {
    throw new Error(`[Taand] Log path escapes storage/logs: ${relativePath}`);
  }

  fs.mkdirSync(path.dirname(normalized), { recursive: true, mode: 0o750 });
  return normalized;
}
