import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ProjectPaths, inProject } from '../core/ProjectPaths.js';

function looksLikeTaandRoot(dir) {
  try {
    return (
      fs.existsSync(inProject(dir, ProjectPaths.entry, 'app.js')) &&
      fs.existsSync(path.join(dir, 'package.json'))
    );
  } catch {
    return false;
  }
}

/**
 * Project root — works from bin/, dist/, cwd, or when TAAND_BASE_PATH is set.
 */
export function resolveProjectRoot(fromUrl = import.meta.url) {
  if (process.env.TAAND_BASE_PATH) {
    return path.resolve(process.env.TAAND_BASE_PATH);
  }

  const cwd = process.cwd();
  if (looksLikeTaandRoot(cwd)) return cwd;

  const here = path.dirname(fileURLToPath(fromUrl));
  const base = path.basename(here);

  if (base === 'dist') return here;
  if (base === ProjectPaths.tools) return path.resolve(here, '..');

  let cur = here;
  for (let i = 0; i < 8; i++) {
    if (looksLikeTaandRoot(cur)) return cur;
    const parent = path.dirname(cur);
    if (parent === cur) break;
    cur = parent;
  }

  return path.resolve(here, '..');
}
