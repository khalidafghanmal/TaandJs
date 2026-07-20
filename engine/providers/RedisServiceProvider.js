import { ServiceProvider } from '../core/ServiceProvider.js';
import { RedisManager } from '../redis/RedisManager.js';
import { RateLimiter } from '../http/RateLimiter.js';

export class RedisServiceProvider extends ServiceProvider {
  register() {
    this.app.singleton('redis', (app) => new RedisManager(app));
    this.app.singleton('rateLimiter', (app) => new RateLimiter(app));
  }
}
