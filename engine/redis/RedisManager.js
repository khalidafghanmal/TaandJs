/**
 * Redis connection manager — lazy connect, shared across cache/queue/session.
 */
export class RedisManager {
  constructor(app) {
    this.app = app;
    this.#clients = new Map();
    this.#connecting = new Map();
  }

  #clients;
  #connecting;

  connection(name = null) {
    const resolved = name ?? this.app.make('config').get('redis.default', 'default');
    return {
      get: (...args) => this.#client(resolved).then((c) => c.get(...args)),
      set: (...args) => this.#client(resolved).then((c) => c.set(...args)),
      setEx: (...args) => this.#client(resolved).then((c) => c.setEx(...args)),
      del: (...args) => this.#client(resolved).then((c) => c.del(...args)),
      incr: (...args) => this.#client(resolved).then((c) => c.incr(...args)),
      expire: (...args) => this.#client(resolved).then((c) => c.expire(...args)),
      ttl: (...args) => this.#client(resolved).then((c) => c.ttl(...args)),
      keys: (...args) => this.#client(resolved).then((c) => c.keys(...args)),
      lPush: (...args) => this.#client(resolved).then((c) => c.lPush(...args)),
      rPop: (...args) => this.#client(resolved).then((c) => c.rPop(...args)),
      lLen: (...args) => this.#client(resolved).then((c) => c.lLen(...args)),
      zAdd: (...args) => this.#client(resolved).then((c) => c.zAdd(...args)),
      zRangeByScore: (...args) => this.#client(resolved).then((c) => c.zRangeByScore(...args)),
      zRem: (...args) => this.#client(resolved).then((c) => c.zRem(...args)),
      hSet: (...args) => this.#client(resolved).then((c) => c.hSet(...args)),
      hGet: (...args) => this.#client(resolved).then((c) => c.hGet(...args)),
      hDel: (...args) => this.#client(resolved).then((c) => c.hDel(...args)),
      ping: () => this.#client(resolved).then((c) => c.ping()),
      prefix: () => this.#prefix(resolved),
      raw: () => this.#client(resolved),
    };
  }

  async disconnect() {
    for (const client of this.#clients.values()) {
      try {
        await client.quit();
      } catch {
        /* ignore */
      }
    }
    this.#clients.clear();
    this.#connecting.clear();
  }

  #config(name) {
    const connections = this.app.make('config').get('redis.connections', {});
    const config = connections[name];
    if (!config) {
      throw new Error(`[Taand] Redis connection [${name}] is not defined`);
    }
    return config;
  }

  #prefix(name) {
    return this.#config(name).prefix ?? 'Taand:';
  }

  async #client(name) {
    if (this.#clients.has(name)) {
      return this.#clients.get(name);
    }

    if (this.#connecting.has(name)) {
      return this.#connecting.get(name);
    }

    const promise = this.#connect(name);
    this.#connecting.set(name, promise);

    try {
      const client = await promise;
      this.#clients.set(name, client);
      return client;
    } finally {
      this.#connecting.delete(name);
    }
  }

  async #connect(name) {
    const config = this.#config(name);
    const { createClient } = await import('redis');

    const client = createClient({ url: config.url });
    client.on('error', (err) => {
      if (this.app.make('config').get('app.debug', false)) {
        console.error(`[Taand] Redis [${name}]`, err.message);
      }
    });

    await client.connect();
    return client;
  }
}
