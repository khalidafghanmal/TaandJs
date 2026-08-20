import fs from 'node:fs';
import path from 'node:path';
import { ProjectPaths, inProject, routesFilePath } from '../../core/ProjectPaths.js';
import { settingsModulePaths } from '../../core/SettingsLoader.js';

/**
 * File mtime signature for cache invalidation.
 */
export function fileSignature(basePath, relativePaths) {
  const parts = [];
  for (const rel of relativePaths) {
    const abs = path.isAbsolute(rel) ? rel : path.join(basePath, rel);
    try {
      const stat = fs.statSync(abs);
      parts.push(`${rel}:${stat.mtimeMs}`);
    } catch {
      parts.push(`${rel}:missing`);
    }
  }
  return parts.join('|');
}

export function cliCachePath(basePath, name) {
  return inProject(basePath, ProjectPaths.varCliCache, name);
}

export function readJsonCache(cacheFile, signature) {
  try {
    const raw = fs.readFileSync(cacheFile, 'utf8');
    const parsed = JSON.parse(raw);
    if (parsed?.signature === signature && parsed?.data !== undefined) {
      return parsed.data;
    }
  } catch {
    /* miss */
  }
  return null;
}

export function writeJsonCache(cacheFile, signature, data) {
  fs.mkdirSync(path.dirname(cacheFile), { recursive: true });
  fs.writeFileSync(cacheFile, JSON.stringify({ signature, data }), 'utf8');
}

export function settingsSignature(basePath) {
  return fileSignature(basePath, settingsModulePaths(basePath));
}

export function routeSignature(basePath) {
  return fileSignature(basePath, [
    routesFilePath(basePath),
    inProject(basePath, ProjectPaths.entry, 'route.js'),
    inProject(basePath, ProjectPaths.entry, 'app.js'),
  ]);
}
