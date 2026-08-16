import fs from 'node:fs/promises';
import path from 'node:path';

export async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

export async function pathExists(p) {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

export async function writeFileSafe(filePath, contents, { force = false } = {}) {
  const dir = path.dirname(filePath);
  await ensureDir(dir);

  if (!force && (await pathExists(filePath))) {
    const err = new Error(`[Taand] File already exists: ${filePath}`);
    err.code = 'EEXISTS';
    throw err;
  }

  await fs.writeFile(filePath, contents, 'utf8');
}

