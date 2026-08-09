import fs from 'node:fs';
import path from 'node:path';
import { inProject, ProjectPaths } from '../core/ProjectPaths.js';

/** PascalCase module folder names — e.g. Billing, ShopApi */
export const MODULE_NAME_PATTERN = /^[A-Z][a-zA-Z0-9]*$/;

/** View slug (first segment) — e.g. billing, shopApi */
export const MODULE_SLUG_PATTERN = /^[a-z][a-zA-Z0-9]*$/;

const CONTROLLER_NAME_PATTERN = /^[A-Z][a-zA-Z0-9]*Controller$/;

export function modulesDir(basePath) {
  return inProject(basePath, ProjectPaths.modules);
}

export function moduleDir(basePath, moduleName) {
  assertModuleName(moduleName);
  return path.join(modulesDir(basePath), moduleName);
}

export function moduleRoutesFile(basePath, moduleName) {
  return path.join(moduleDir(basePath, moduleName), 'routes.js');
}

export function moduleViewsDir(basePath, moduleName) {
  return path.join(moduleDir(basePath, moduleName), 'ui');
}

export function moduleSlug(moduleName) {
  assertModuleName(moduleName);
  return moduleName.charAt(0).toLowerCase() + moduleName.slice(1);
}

export function assertModuleName(name) {
  if (!MODULE_NAME_PATTERN.test(name)) {
    throw new Error(`[Taand] Invalid module name: ${name}`);
  }
}

/**
 * List feature module directories under src/features/ (safe names only).
 */
export function listModuleNames(basePath) {
  const root = modulesDir(basePath);
  if (!fs.existsSync(root)) return [];

  return fs
    .readdirSync(root, { withFileTypes: true })
    .filter((e) => e.isDirectory() && MODULE_NAME_PATTERN.test(e.name))
    .map((e) => e.name)
    .sort();
}

/**
 * Resolve slug → PascalCase module folder (billing → Billing).
 */
export function findModuleBySlug(basePath, slug) {
  if (!MODULE_SLUG_PATTERN.test(slug)) return null;

  const target = slug.charAt(0).toUpperCase() + slug.slice(1);
  const dir = moduleDir(basePath, target);
  if (!fs.existsSync(dir)) return null;

  return target;
}

/**
 * Locate src/features/{Module}/{ControllerName}.js — unique match only.
 */
export function resolveModuleControllerFile(basePath, controllerName) {
  if (!CONTROLLER_NAME_PATTERN.test(controllerName)) {
    return null;
  }

  let match = null;

  for (const moduleName of listModuleNames(basePath)) {
    const file = path.join(moduleDir(basePath, moduleName), `${controllerName}.js`);
    if (!fs.existsSync(file)) continue;

    if (match) {
      throw new Error(
        `[Taand] Ambiguous controller [${controllerName}] — found in modules [${match.module}] and [${moduleName}]`,
      );
    }

    match = { module: moduleName, file: path.resolve(file) };
  }

  return match?.file ?? null;
}

/**
 * Resolve module view: billing.index → src/features/Billing/ui/index.taand
 */
export function resolveModuleViewFile(basePath, viewName) {
  const dot = viewName.indexOf('.');
  if (dot <= 0) return null;

  const slug = viewName.slice(0, dot);
  const rest = viewName.slice(dot + 1);

  if (!MODULE_SLUG_PATTERN.test(slug) || !rest || !/^[a-zA-Z][a-zA-Z0-9._-]*$/.test(rest)) {
    return null;
  }

  const moduleName = findModuleBySlug(basePath, slug);
  if (!moduleName) return null;

  const viewsRoot = path.resolve(moduleViewsDir(basePath, moduleName));
  const relative = rest.split('.').join(path.sep);
  const filePath = path.resolve(viewsRoot, `${relative}.taand`);

  if (!filePath.startsWith(viewsRoot + path.sep)) {
    throw new Error(`[TaandView] Invalid module view path: ${viewName}`);
  }

  if (!fs.existsSync(filePath)) return null;

  return filePath;
}
