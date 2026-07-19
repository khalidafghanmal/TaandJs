import { CacheRepository } from './CacheRepository.js';
import { MemoryDriver } from './drivers/MemoryDriver.js';
import { FileDriver } from './drivers/FileDriver.js';
import { NullDriver } from './drivers/NullDriver.js';
import { RedisDriver } from './drivers/RedisDriver.js';

const CACHE_METHODS = [
  'get', 'many', 'put', 'putMany', 'add', 'forever', 'remember', 'rememberForever',
  'flexible', 'memo', 'pull', 'has', 'missing', 'forget', 'flush',
  'increment', 'decrement', 'lock', 'tags', 'stats', 'driverStats', 'storeName',
];

/**
 * Cache manager — multi-store cache with taand-style API + Taand extras.
 */
export class CacheManager {
  constructor(app) {
    this.app = app;
    this.#stores = new Map();
    this.#default = app.make('config').get('cache.default', 'memory');
  }

  #stores;
  #default;

  store(name = null) {
    const resolved = name ?? this.#default;
    if (!this.#stores.has(resolved)) {
      this.#stores.set(resolved, this.#buildStore(resolved));
    }
    return this.#stores.get(resolved);
  }

  driver(name = null) {
    return this.store(name);
  }

  async overview() {
    const stores = this.app.make('config').get('cache.stores', {});
    const result = {};

    for (const name of Object.keys(stores)) {
      const repo = this.store(name);
      const driverStats = await repo.driverStats();
      result[name] = {
        driver: stores[name].driver,
        stats: repo.stats(),
        driverStats,
        keys: await repo.keys(100),
      };
    }

    return result;
  }

  #buildStore(name) {
    const stores = this.app.make('config').get('cache.stores', {});
    const config = stores[name];
    if (!config) {
      throw new Error(`[Taand] Cache store [${name}] is not defined`);
    }

    const prefix = this.app.make('config').get('cache.prefix', '');
    const driver = this.#createDriver(config);
    return new CacheRepository(this.app, driver, { prefix, store: name });
  }

  #createDriver(config) {
    const driver = config.driver ?? 'memory';

    if (driver === 'null') return new NullDriver();
    if (driver === 'memory' || driver === 'array') {
      return new MemoryDriver(config);
    }
    if (driver === 'file') {
      return new FileDriver(this.app, config);
    }
    if (driver === 'redis') {
      return new RedisDriver(this.app, config);
    }

    throw new Error(`[Taand] Unsupported cache driver [${driver}]`);
  }
}

for (const method of CACHE_METHODS) {
  CacheManager.prototype[method] = function proxyCache(...args) {
    return this.store()[method](...args);
  };
}
