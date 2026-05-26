import fs from 'node:fs';
import { pathToFileURL } from 'node:url';
import { inProject, settingsFile } from './ProjectPaths.js';

/** taand-native settings modules (settings/*.js). */
export const SETTINGS_MODULES = [
  'runtime',
  'server',
  'http',
  'security',
  'data',
  'platform',
  'ui',
  'errors',
  'validation',
];

/** Legacy settings modules — loaded when settings/ is absent. */
const LEGACY_MODULES = [
  'app',
  'server',
  'view',
  'middleware',
  'cors',
  'assets',
  'database',
  'auth',
  'errors',
  'validation',
  'logging',
  'events',
  'cache',
  'mail',
  'queue',
  'redis',
  'filesystems',
];

function legacyConfigDir(basePath) {
  return inProject(basePath, 'config');
}

export function usesLegacyConfig(basePath) {
  return !fs.existsSync(settingsFile(basePath, 'runtime.js'))
    && fs.existsSync(inProject(basePath, 'config', 'app.js'));
}

async function importModule(basePath, name, reloadStamp = null) {
  const file = settingsFile(basePath, `${name}.js`);
  const href = pathToFileURL(file).href;
  const url = reloadStamp ? `${href}?t=${reloadStamp}` : href;
  const mod = await import(url);
  return mod.default;
}

async function importLegacyModule(basePath, name, reloadStamp = null) {
  const file = inProject(basePath, 'config', `${name}.js`);
  const href = pathToFileURL(file).href;
  const url = reloadStamp ? `${href}?t=${reloadStamp}` : href;
  const mod = await import(url);
  return mod.default;
}

/**
 * Map taand-native settings into the internal registry consumed by the engine.
 */
export function normalizeSettings(raw) {
  const security = raw.security ?? {};
  const browser = security.browser ?? {};
  const token = security.token ?? {};
  const hashing = security.hashing ?? { scrypt: {} };

  return {
    app: raw.runtime ?? {},
    server: raw.server ?? {},
    view: raw.ui ?? {},
    middleware: {
      global: raw.http?.global ?? [],
      groups: {
        web: raw.http?.stacks?.browser ?? [],
        api: raw.http?.stacks?.json ?? [],
      },
      aliases: {
        auth: raw.http?.filters?.signedIn ?? 'authenticate',
        guest: raw.http?.filters?.signedOut ?? 'guestOnly',
      },
      priority: raw.http?.priority ?? [],
    },
    cors: raw.http?.crossOrigin ?? {},
    database: raw.data?.primary ?? {},
    redis: raw.data?.redis ?? {},
    auth: {
      default: security.defaultMode === 'browser' ? 'session' : (security.defaultMode ?? 'session'),
      guards: {
        session: { driver: 'session', provider: 'users' },
        api: { driver: 'token', provider: 'users' },
      },
      tokens: {
        prefix: token.prefix ?? '',
        expirationDays: token.expirationDays ?? null,
        fallback: token.fallback ?? '',
        machineAbilities: token.machineAbilities ?? ['*'],
      },
      providers: security.accounts ?? { users: { driver: 'prisma', model: 'user' } },
      passwords: { scrypt: hashing.scrypt ?? {} },
      session: browser.session ?? {},
      remember: browser.remember ?? {},
      routes: browser.pages ?? {},
      roles: security.roles ?? {},
    },
    errors: raw.errors ?? {},
    validation: raw.validation ?? {},
    logging: raw.platform?.observability ?? {},
    events: raw.platform?.dispatch ?? {},
    cache: raw.platform?.memory ?? {},
    mail: raw.platform?.notify ?? {},
    queue: raw.platform?.jobs ?? {},
    filesystems: raw.platform?.volumes ?? {},
    assets: raw.platform?.static ?? {},
  };
}

async function loadRawSettings(basePath, reloadStamp = null) {
  if (usesLegacyConfig(basePath)) {
    const legacy = {};
    for (const key of LEGACY_MODULES) {
      const file = inProject(basePath, 'config', `${key}.js`);
      if (fs.existsSync(file)) {
        legacy[key] = await importLegacyModule(basePath, key, reloadStamp);
      }
    }
    return { legacy: true, modules: legacy };
  }

  const modules = {};
  for (const key of SETTINGS_MODULES) {
    modules[key] = await importModule(basePath, key, reloadStamp);
  }
  return { legacy: false, modules };
}

/**
 * Load project settings and return the normalized engine registry.
 */
export async function loadSettingsRegistry(basePath, { reloadStamp = null } = {}) {
  const raw = await loadRawSettings(basePath, reloadStamp);

  if (raw.legacy) {
    const m = raw.modules;
    return {
      app: m.app ?? {},
      server: m.server ?? {},
      view: m.view ?? {},
      middleware: m.middleware ?? {},
      cors: m.cors ?? {},
      assets: m.assets ?? {},
      database: m.database ?? {},
      auth: m.auth ?? {},
      errors: m.errors ?? {},
      validation: m.validation ?? {},
      logging: m.logging ?? {},
      events: m.events ?? {},
      cache: m.cache ?? {},
      mail: m.mail ?? {},
      queue: m.queue ?? {},
      redis: m.redis ?? {},
      filesystems: m.filesystems ?? {},
    };
  }

  return normalizeSettings(raw.modules);
}

/**
 * Load raw taand-native settings for CLI display / caching.
 */
export async function loadSettingsModules(basePath, { reloadStamp = null } = {}) {
  const raw = await loadRawSettings(basePath, reloadStamp);
  if (raw.legacy) {
    return raw.modules;
  }
  return raw.modules;
}

export function settingsModulePaths(basePath) {
  if (usesLegacyConfig(basePath)) {
    return LEGACY_MODULES.map((m) => inProject(basePath, 'config', `${m}.js`)).filter((p) => fs.existsSync(p));
  }
  return SETTINGS_MODULES.map((m) => settingsFile(basePath, `${m}.js`));
}
