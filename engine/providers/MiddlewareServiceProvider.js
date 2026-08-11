import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { ServiceProvider } from '../core/ServiceProvider.js';
import { HandleCors } from '../middleware/global/HandleCors.js';
import { LogRequest } from '../middleware/global/LogRequest.js';
import { TrimInput } from '../middleware/global/TrimInput.js';
import { ValidatePostSize } from '../middleware/global/ValidatePostSize.js';
import { SecurityHeaders } from '../middleware/global/SecurityHeaders.js';
import { CsrfProtection } from '../middleware/web/CsrfProtection.js';
import { ForceJson } from '../middleware/api/ForceJson.js';
import { ThrottleRequests } from '../middleware/ThrottleRequests.js';
import { LockoutRequests } from '../middleware/LockoutRequests.js';
import { Authenticate } from '../middleware/Authenticate.js';
import { TrustProxies } from '../middleware/TrustProxies.js';
import { GuestOnly } from '../middleware/GuestOnly.js';
import { StartSession } from '../middleware/StartSession.js';
import { RoleMiddleware } from '../middleware/auth/RoleMiddleware.js';
import { Authorize } from '../middleware/auth/Authorize.js';
import { TokenAbilities } from '../middleware/auth/TokenAbilities.js';

import { applicationFile } from '../core/ProjectPaths.js';

export class MiddlewareServiceProvider extends ServiceProvider {
  register() {
    const registry = this.app.make('middleware');

    registry.register('startSession', StartSession);
    registry.register('cors', HandleCors);
    registry.register('trustProxies', TrustProxies);
    registry.register('validateSize', ValidatePostSize);
    registry.register('trim', TrimInput);
    registry.register('log', LogRequest);
    registry.register('security', SecurityHeaders);
    registry.register('csrf', CsrfProtection);
    registry.register('json', ForceJson);
    registry.register('throttle', ThrottleRequests);
    registry.register('lockout', LockoutRequests);
    registry.register('authenticate', Authenticate);
    registry.register('guestOnly', GuestOnly);
    registry.register('role', RoleMiddleware);
    registry.register('can', Authorize);
    registry.register('abilities', TokenAbilities);

    const config = this.app.make('config').get('middleware', {});

    for (const [name, stack] of Object.entries(config.groups ?? {})) {
      registry.group(name, stack);
    }

    if (config.aliases) {
      registry.alias(config.aliases);
    }

    if (config.priority) {
      registry.priority(config.priority);
    }
  }

  async boot() {
    const kernel = this.app.make('kernel');
    const config = this.app.make('config').get('middleware', {});
    kernel.setGlobalMiddleware(config.global ?? ['log']);

    await this.#loadUserMiddleware();
  }

  async #loadUserMiddleware() {
    const file = applicationFile(this.app.basePath, 'middleware.js');

    try {
      const mod = await import(pathToFileURL(file).href);
      await mod.default?.(this.app.make('middleware'), this.app);
    } catch (err) {
      if (err.code !== 'ERR_MODULE_NOT_FOUND') throw err;
    }
  }
}
