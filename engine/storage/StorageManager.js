import { LocalDriver } from './drivers/LocalDriver.js';
import { S3Driver } from './drivers/S3Driver.js';

/**
 * Storage manager — Taand disk abstraction for local and cloud files.
 */
export class StorageManager {
  constructor(app) {
    this.app = app;
    this.#disks = new Map();
    this.#default = app.make('config').get('filesystems.default', 'local');
  }

  #disks;
  #default;

  disk(name = null) {
    const resolved = name ?? this.#default;
    if (!this.#disks.has(resolved)) {
      this.#disks.set(resolved, this.#build(resolved));
    }
    return this.#disks.get(resolved);
  }

  async put(path, contents, options = {}) {
    return this.disk(options.disk).put(path, contents, options);
  }

  async get(path, disk = null) {
    return this.disk(disk).get(path);
  }

  async delete(path, disk = null) {
    return this.disk(disk).delete(path);
  }

  url(path, disk = null) {
    return this.disk(disk).url(path);
  }

  #build(name) {
    const disks = this.app.make('config').get('filesystems.disks', {});
    const config = disks[name];
    if (!config) {
      throw new Error(`[Taand] Storage disk [${name}] is not defined`);
    }

    const driver = config.driver ?? 'local';
    if (driver === 'local') return new LocalDriver(this.app, config);
    if (driver === 's3') return new S3Driver(this.app, config);

    throw new Error(`[Taand] Unsupported storage driver [${driver}] on disk [${name}]`);
  }
}
