import { loadApp } from '../utils/loadApp.js';
import { resolveProjectRoot } from '../../server/resolveRoot.js';
import { cliCachePath, readJsonCache, routeSignature, writeJsonCache } from './CliCache.js';

function formatAction(action) {
  if (typeof action === 'function') return 'Closure';
  return String(action);
}

function serializeRoutes(routes) {
  return routes.map((r) => ({
    methods: r.methods.join('|'),
    uri: r.uri,
    name: r.routeName ?? '',
    action: formatAction(r.action),
    middleware: (r.middlewareStack ?? []).join(','),
  }));
}

let memoryRoutes = null;
let memorySignature = null;

/**
 * Load route table with lite bootstrap (no DB/providers) + mtime cache.
 */
export async function loadRoutesCached(fromUrl = import.meta.url, { refresh = false } = {}) {
  const basePath = resolveProjectRoot(fromUrl);
  const signature = routeSignature(basePath);

  if (!refresh && memoryRoutes && memorySignature === signature) {
    return memoryRoutes;
  }

  const cacheFile = cliCachePath(basePath, 'routes.json');
  if (!refresh) {
    const cached = readJsonCache(cacheFile, signature);
    if (cached) {
      memoryRoutes = cached;
      memorySignature = signature;
      return cached;
    }
  }

  const app = await loadApp(fromUrl);

  await app.bootstrapCli('routes');
  const rows = serializeRoutes(app.make('router').routes.all());
  writeJsonCache(cacheFile, signature, rows);
  memoryRoutes = rows;
  memorySignature = signature;
  return rows;
}

export function clearRouteCache() {
  memoryRoutes = null;
  memorySignature = null;
}

export function renderRouteTable(rows) {
  function padRight(s, width) {
    return `${s}${' '.repeat(Math.max(0, width - s.length))}`;
  }

  const widths = {
    methods: Math.max('METHOD'.length, ...rows.map((x) => x.methods.length)),
    uri: Math.max('URI'.length, ...rows.map((x) => x.uri.length)),
    name: Math.max('NAME'.length, ...rows.map((x) => x.name.length)),
    action: Math.max('ACTION'.length, ...rows.map((x) => x.action.length)),
  };

  let out = `${padRight('METHOD', widths.methods)}  ${padRight('URI', widths.uri)}  ${padRight('NAME', widths.name)}  ${padRight('ACTION', widths.action)}  MIDDLEWARE\n`;

  for (const row of [...rows].sort((a, b) => a.uri.localeCompare(b.uri))) {
    out += `${padRight(row.methods, widths.methods)}  ${padRight(row.uri, widths.uri)}  ${padRight(row.name, widths.name)}  ${padRight(row.action, widths.action)}  ${row.middleware}\n`;
  }

  return out;
}

export function clearRouteCacheForProject() {
  clearRouteCache();
}
