import path from 'node:path';
import {
  controllersDir,
  inProject,
  ProjectPaths,
  appDir,
  jobsDir,
  listenersDir,
  mailDir,
  eventsClassDir,
  middlewareDir,
  providersDir,
} from '../../core/ProjectPaths.js';
import { toPascalCase } from '../utils/strings.js';

function parseSubdir(raw) {
  return path
    .dirname(String(raw).replace(/\\/g, '/'))
    .split('/')
    .filter((p) => p && p !== '.')
    .join(path.sep);
}

function baseClassName(raw) {
  return toPascalCase(path.basename(raw));
}

/** Generator specs — stub name + output path resolution. No framework imports. */
export const GENERATOR_DEFINITIONS = {
  controller: {
    stub: 'controller',
    missing: 'Missing controller name',
    resolve(ctx, raw) {
      const className = baseClassName(raw);
      const relDir = parseSubdir(raw);
      const outDir = relDir ? path.join(controllersDir(ctx.root), relDir) : controllersDir(ctx.root);
      return {
        outFile: path.join(outDir, `${className}.js`),
        vars: { class: className },
        label: className,
      };
    },
  },

  middleware: {
    stub: 'middleware',
    missing: 'Missing middleware name',
    resolve(ctx, raw) {
      const className = baseClassName(raw);
      const relDir = parseSubdir(raw);
      const outDir = relDir
        ? path.join(middlewareDir(ctx.root), relDir)
        : middlewareDir(ctx.root);
      return {
        outFile: path.join(outDir, `${className}.js`),
        vars: { class: className },
        label: className,
      };
    },
  },

  provider: {
    stub: 'provider',
    missing: 'Missing provider name',
    resolve(ctx, raw) {
      const className = baseClassName(raw);
      return {
        outFile: path.join(providersDir(ctx.root), `${className}.js`),
        vars: { class: className },
        label: className,
      };
    },
  },

  job: {
    stub: 'job',
    missing: 'Missing job name',
    resolve(ctx, raw) {
      const className = baseClassName(raw);
      return {
        outFile: path.join(jobsDir(ctx.root), `${className}.js`),
        vars: { class: className },
        label: className,
      };
    },
  },

  event: {
    stub: 'event',
    missing: 'Missing event name',
    resolve(ctx, raw) {
      const className = baseClassName(raw);
      return {
        outFile: path.join(eventsClassDir(ctx.root), `${className}.js`),
        vars: { class: className },
        label: className,
      };
    },
  },

  listener: {
    stub: 'listener',
    missing: 'Missing listener name',
    resolve(ctx, raw) {
      const className = baseClassName(raw);
      return {
        outFile: path.join(listenersDir(ctx.root), `${className}.js`),
        vars: { class: className },
        label: className,
      };
    },
  },

  mail: {
    stub: 'mail',
    missing: 'Missing mailable name',
    resolve(ctx, raw) {
      const className = baseClassName(raw);
      return {
        outFile: path.join(mailDir(ctx.root), `${className}.js`),
        vars: { class: className },
        label: className,
      };
    },
  },

  seeder: {
    stub: 'seeder',
    missing: 'Missing seeder name',
    resolve(ctx, raw) {
      let className = toPascalCase(raw);
      if (!className.endsWith('Seeder')) className += 'Seeder';
      return {
        outFile: path.join(inProject(ctx.root, ProjectPaths.seeds), `${className}.js`),
        vars: { class: className },
        label: className,
      };
    },
  },

  model: {
    stub: 'model',
    missing: 'Missing model name',
    resolve(ctx, raw) {
      const className = baseClassName(raw);
      const delegate = className.charAt(0).toLowerCase() + className.slice(1);
      return {
        outFile: path.join(appDir(ctx.root), 'models', `${className}.js`),
        vars: { class: className, delegate },
        label: className,
      };
    },
  },

  module: {
    stub: 'module-controller',
    missing: 'Missing module name',
    resolve(ctx, raw) {
      const moduleName = baseClassName(raw);
      const controllerName = `${moduleName}Controller`;
      const slug = moduleName.charAt(0).toLowerCase() + moduleName.slice(1);
      const moduleDirPath = path.join(inProject(ctx.root, ProjectPaths.modules), moduleName);
      const uiDir = path.join(moduleDirPath, 'ui');
      return {
        outFile: path.join(moduleDirPath, `${controllerName}.js`),
        vars: { class: controllerName, module: moduleName, moduleSlug: slug, controller: controllerName },
        label: moduleName,
        extraFiles: [
          {
            path: path.join(moduleDirPath, 'routes.js'),
            stub: 'module-routes',
            vars: { module: moduleName, moduleSlug: slug, controller: controllerName },
          },
          {
            path: path.join(uiDir, 'index.taand'),
            stub: 'module-view',
            vars: { module: moduleName, moduleSlug: slug },
          },
        ],
      };
    },
  },
};

/** Maps CLI command names to generator ids. */
export const MAKE_COMMAND_TO_GENERATOR = {
  'make:controller': 'controller',
  'make:middleware': 'middleware',
  'make:provider': 'provider',
  'make:job': 'job',
  'make:event': 'event',
  'make:listener': 'listener',
  'make:mail': 'mail',
  'make:seeder': 'seeder',
  'make:model': 'model',
  'make:module': 'module',
};

export const GENERATOR_STUB_NAMES = [
  ...new Set([
    ...Object.values(GENERATOR_DEFINITIONS).map((d) => d.stub),
    'module-routes',
    'module-view',
  ]),
];
