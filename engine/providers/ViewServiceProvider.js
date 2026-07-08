import path from 'node:path';
import { ServiceProvider } from '../core/ServiceProvider.js';
import { ViewEngine } from '../view/ViewEngine.js';
import { createViewHelper } from '../view/View.js';
import { ProjectPaths, inProject, viewsDir } from '../core/ProjectPaths.js';

export class ViewServiceProvider extends ServiceProvider {
  register() {
    this.app.singleton('view', () => {
      const config = this.app.make('config').get('view', {});
      return new ViewEngine(this.app).configure({
        viewsPath: viewsDir(this.app.basePath),
        basePath: this.app.basePath,
        cachePath: inProject(this.app.basePath, ProjectPaths.varViewCache),
        cacheEnabled: config.cache !== false,
      });
    });

    this.app.instance('view.helper', createViewHelper(this.app));
  }
}
