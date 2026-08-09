import fs from 'node:fs';
import { pathToFileURL } from 'node:url';
import { listModuleNames, moduleRoutesFile } from './ModulePaths.js';

/**
 * Auto-load src/features feature routes after flow/http.js (same Router).
 */
export async function loadModuleRoutes(app, { reload = false } = {}) {
  const modulesConfig = app.make('config').get('app.modules', {});

  if (modulesConfig.enabled === false || modulesConfig.autoRoutes === false) {
    return [];
  }

  const basePath = app.basePath;
  const loaded = [];

  for (const moduleName of listModuleNames(basePath)) {
    const routesFile = moduleRoutesFile(basePath, moduleName);

    if (!fs.existsSync(routesFile)) continue;

    const href = pathToFileURL(routesFile).href;
    const url = reload ? `${href}?taand-module-reload=${Date.now()}` : href;

    await import(url);
    loaded.push(moduleName);
  }

  return loaded;
}
