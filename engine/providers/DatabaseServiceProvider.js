import fs from 'node:fs';
import { ServiceProvider } from '../core/ServiceProvider.js';
import { PrismaManager } from '../database/PrismaManager.js';
import { paginate as paginateQuery } from '../database/paginate.js';
import { ProjectPaths, inProject } from '../core/ProjectPaths.js';

export class DatabaseServiceProvider extends ServiceProvider {
  register() {
    this.app.singleton('prisma', () => new PrismaManager(this.app));
    this.app.singleton('db', (app) => app.make('prisma').client());
    this.app.singleton('paginator', () => ({
      paginate: paginateQuery,
    }));
  }

  async boot() {
    fs.mkdirSync(inProject(this.app.basePath, ProjectPaths.varDatabase), { recursive: true });
    await this.app.make('prisma').connect();
  }
}
