import fs from 'node:fs';
import path from 'node:path';

/**
 * Resolves cache paths safely — blocks path traversal outside storage/cache.
 */
export function resolveCachePath(basePath, relativePath, cacheDir = 'storage/cache') {
  const allowedRoot = path.resolve(basePath, cacheDir);
  const resolved = path.resolve(basePath, relativePath);
  const normalized = path.normalize(resolved);

  if (!normalized.startsWith(allowedRoot + path.sep) && normalized !== allowedRoot) {
    throw new Error(`[Taand] Cache path escapes storage/cache: ${relativePath}`);
  }

  fs.mkdirSync(normalized, { recursive: true, mode: 0o750 });
  return normalized;
}
