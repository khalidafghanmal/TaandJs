import { pathToFileURL } from 'node:url';
import { resolveProjectRoot } from '../../server/resolveRoot.js';
import { ProjectPaths, inProject } from '../../core/ProjectPaths.js';

/**
 * Resolve the Taand project root (source tree or dist/).
 */
export function resolvetaandbasePath(fromUrl = import.meta.url) {
  return resolveProjectRoot(fromUrl);
}

let cachedApp = null;
let cachedBasePath = null;

/**
 * Load the app singleton from the resolved project root.
 */
export async function loadApp(fromUrl = import.meta.url) {
  const basePath = resolvetaandbasePath(fromUrl);
  process.env.TAAND_BASE_PATH = basePath;

  if (cachedApp && cachedBasePath === basePath) {
    return cachedApp;
  }

  const mod = await import(pathToFileURL(inProject(basePath, ProjectPaths.entry, 'app.js')).href);
  cachedApp = mod.app;
  cachedBasePath = basePath;
  return cachedApp;
}
