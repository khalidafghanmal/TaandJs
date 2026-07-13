import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { ServiceProvider } from '../core/ServiceProvider.js';
import { Hasher } from '../auth/Hasher.js';
import { createSessionStore } from '../auth/createSessionStore.js';
import { UserProvider } from '../auth/UserProvider.js';
import { AuthManager } from '../auth/AuthManager.js';
import { PersonalAccessTokenManager } from '../auth/PersonalAccessTokenManager.js';
import { Gate } from '../auth/Gate.js';

import { applicationFile } from '../core/ProjectPaths.js';

export class AuthServiceProvider extends ServiceProvider {
  register() {
    const config = this.app.make('config');

    this.app.singleton('hasher', () => {
      const options = config.get('auth.passwords.scrypt', {});
      return new Hasher(options);
    });

    this.app.singleton('session', (app) => createSessionStore(app));
    this.app.singleton('users', (app) => new UserProvider(app));
    this.app.singleton('tokens', (app) => new PersonalAccessTokenManager(app));
    this.app.singleton('auth', (app) => new AuthManager(app));
    this.app.singleton('gate', (app) => new Gate(app));
  }

  async boot() {
    await this.#loadPolicies();
  }

  async #loadPolicies() {
    const file = applicationFile(this.app.basePath, 'policies.js');

    try {
      const mod = await import(pathToFileURL(file).href);
      await mod.default?.(this.app.make('gate'), this.app);
    } catch (err) {
      if (err.code !== 'ERR_MODULE_NOT_FOUND') throw err;
    }
  }
}
