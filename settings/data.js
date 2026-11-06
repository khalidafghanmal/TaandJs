import { env } from '../engine/core/Env.js';

/** Data stores — primary database and Redis connections. */
export default {
  primary: {
    connection: env('DB_CONNECTION', 'sqlite'),
    url: env('DATABASE_URL', 'file:../storage/database/taand.db'),
  },

  redis: {
    default: env('REDIS_CONNECTION', 'default'),
    client: env('REDIS_CLIENT', 'redis'),
    connections: {
      default: {
        url: env('REDIS_URL', 'redis://127.0.0.1:6379'),
        prefix: env('REDIS_PREFIX', 'Taand:'),
      },
      cache: {
        url: env('REDIS_CACHE_URL', env('REDIS_URL', 'redis://127.0.0.1:6379')),
        prefix: env('REDIS_CACHE_PREFIX', env('REDIS_PREFIX', 'Taand:cache:')),
      },
      session: {
        url: env('REDIS_SESSION_URL', env('REDIS_URL', 'redis://127.0.0.1:6379')),
        prefix: env('REDIS_SESSION_PREFIX', env('REDIS_PREFIX', 'Taand:session:')),
      },
      queue: {
        url: env('REDIS_QUEUE_URL', env('REDIS_URL', 'redis://127.0.0.1:6379')),
        prefix: env('REDIS_QUEUE_PREFIX', env('REDIS_PREFIX', 'Taand:queue:')),
      },
    },
  },
};
