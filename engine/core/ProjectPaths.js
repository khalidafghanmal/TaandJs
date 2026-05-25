import fs from 'node:fs';
import path from 'node:path';

/**
 * TaandJs project layout.
 * All runtime paths resolve through this module so the outer structure can stay
 * small, distinct, and framework-owned.
 */
export const ProjectPaths = {
  kernel: 'engine',
  entry: 'start',
  settings: 'settings',

  // Application code
  app: 'src',
  controllers: 'src/actions',
  resources: 'src/resources',
  jobs: 'src/jobs',
  listeners: 'src/listeners',
  mail: 'src/mail',
  events: 'src/events',
  middleware: 'src/middleware',
  providers: 'src/providers',

  /** Feature modules (optional) — src/features/{Name}/ */
  modules: 'src/features',

  // HTTP flow and UI
  routes: 'flow',
  routeFile: 'flow/http.js',
  views: 'ui',
  public: 'web',

  var: 'storage',
  varCache: 'storage/cache/data',
  varLogs: 'storage/logs',
  varSessions: 'storage/sessions',
  varUploads: 'storage/uploads',
  varDatabase: 'storage/database',
  varViewCache: 'storage/view-cache',
  varMailOutbox: 'storage/mail/outbox',
  varCliCache: 'storage/cli-cache',
  seeds: 'records/seeds',
  prisma: 'schema',
  tools: 'bin',
  tests: 'specs',
};

export function inProject(basePath, ...segments) {
  return path.join(basePath, ...segments);
}

/**
 * Resolve the first existing relative path under basePath.
 * Falls back to the first candidate when none exist yet (generators / fresh apps).
 */
export function resolveProjectPath(basePath, candidates) {
  for (const rel of candidates) {
    const full = inProject(basePath, rel);
    if (fs.existsSync(full)) return full;
  }
  return inProject(basePath, candidates[0]);
}

export function handlersDir(basePath) {
  return controllersDir(basePath);
}

export function controllersDir(basePath) {
  return resolveProjectPath(basePath, [ProjectPaths.controllers]);
}

export function appDir(basePath) {
  return resolveProjectPath(basePath, [ProjectPaths.app]);
}

export function viewsDir(basePath) {
  return resolveProjectPath(basePath, [ProjectPaths.views]);
}

export function publicDir(basePath) {
  return resolveProjectPath(basePath, [ProjectPaths.public]);
}

export function routesFilePath(basePath) {
  return resolveProjectPath(basePath, [ProjectPaths.routeFile]);
}

export function resolveAppSubdir(basePath, primary) {
  return resolveProjectPath(basePath, [primary]);
}

export function jobsDir(basePath) {
  return resolveAppSubdir(basePath, ProjectPaths.jobs);
}

export function listenersDir(basePath) {
  return resolveAppSubdir(basePath, ProjectPaths.listeners);
}

export function mailDir(basePath) {
  return resolveAppSubdir(basePath, ProjectPaths.mail);
}

export function resourcesDir(basePath) {
  return resolveAppSubdir(basePath, ProjectPaths.resources);
}

export function eventsClassDir(basePath) {
  return resolveAppSubdir(basePath, ProjectPaths.events);
}

export function middlewareDir(basePath) {
  return resolveAppSubdir(basePath, ProjectPaths.middleware);
}

export function providersDir(basePath) {
  return resolveAppSubdir(basePath, ProjectPaths.providers);
}

export function settingsFile(basePath, name) {
  return inProject(basePath, ProjectPaths.settings, name);
}

export function applicationFile(basePath, name) {
  return path.join(appDir(basePath), name);
}
