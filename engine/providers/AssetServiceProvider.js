import { ServiceProvider } from '../core/ServiceProvider.js';
import { AssetManager } from '../assets/AssetManager.js';
import { Uploader } from '../assets/Uploader.js';
import { StaticFileServer } from '../assets/StaticFileServer.js';
import { createAssetHelper } from '../assets/helpers.js';

export class AssetServiceProvider extends ServiceProvider {
  register() {
    this.app.singleton('assets', () => new AssetManager(this.app));
    this.app.singleton('uploader', () => new Uploader(this.app));
    this.app.singleton('static', () => new StaticFileServer(this.app));
    this.app.instance('asset.helper', createAssetHelper(this.app));
  }

  boot() {
    this.app.make('assets').ensureDirectories();
  }
}
