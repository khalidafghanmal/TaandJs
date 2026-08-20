import { loadEnv } from '../../core/Env.js';
import {
  loadSettingsModules,
} from '../../core/SettingsLoader.js';
import {
  cliCachePath,
  readJsonCache,
  settingsSignature,
  writeJsonCache,
} from './CliCache.js';

let memoryConfig = null;
let memorySignature = null;

/**
 * Load resolved settings without booting providers, DB, or routes.
 * Uses fixed module list + mtime cache — no directory scanning.
 */
export async function loadConfigCached(basePath, { refresh = false } = {}) {
  const signature = settingsSignature(basePath);

  if (!refresh && memoryConfig && memorySignature === signature) {
    return memoryConfig;
  }

  const cacheFile = cliCachePath(basePath, 'config.json');
  if (!refresh) {
    const cached = readJsonCache(cacheFile, signature);
    if (cached) {
      memoryConfig = cached;
      memorySignature = signature;
      return cached;
    }
  }

  loadEnv(basePath);
  const modules = await loadSettingsModules(basePath);

  writeJsonCache(cacheFile, signature, modules);
  memoryConfig = modules;
  memorySignature = signature;
  return modules;
}

export function clearConfigCache() {
  memoryConfig = null;
  memorySignature = null;
}

export function getConfigValue(config, key) {
  if (!key) return config;
  const parts = key.split('.').filter(Boolean);
  let cur = config[parts[0]];
  for (let i = 1; i < parts.length; i++) {
    if (cur == null || typeof cur !== 'object') return undefined;
    cur = cur[parts[i]];
  }
  return key.includes('.') ? cur : config[key];
}
