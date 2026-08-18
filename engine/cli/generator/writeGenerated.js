import fs from 'node:fs';
import path from 'node:path';

/** Sync file writer — faster than async for single-file generation. */
export function writeGeneratedFile(filePath, contents, { force = false } = {}) {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });

  if (!force && fs.existsSync(filePath)) {
    const err = new Error(`[Taand] File already exists: ${filePath}`);
    err.code = 'EEXISTS';
    throw err;
  }

  fs.writeFileSync(filePath, contents, 'utf8');
}
