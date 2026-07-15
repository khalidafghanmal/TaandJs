import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { ProjectPaths, inProject } from '../core/ProjectPaths.js';

/**
 * Run a seeder class from records/seeds/.
 */
export async function runSeeder(app, SeederClass) {
  if (!SeederClass?.prototype?.run) {
    throw new TypeError('[Taand] Seeder must implement run()');
  }

  await app.bootstrap();

  const seeder = new SeederClass(app);
  await seeder.run();
}

/**
 * Load and run DatabaseSeeder (or --class=NameSeeder).
 */
export async function runDatabaseSeed(app, options = {}) {
  const basePath = app.basePath;
  const className = options.className ?? 'DatabaseSeeder';
  const file = inProject(basePath, ProjectPaths.seeds, `${className}.js`);
  const mod = await import(pathToFileURL(file).href);
  const SeederClass = mod[className] ?? mod.default;

  if (!SeederClass) {
    throw new Error(`[Taand] Seeder class "${className}" not found in ${file}`);
  }

  await runSeeder(app, SeederClass);
}
