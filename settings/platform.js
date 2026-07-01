import { env } from '../engine/core/Env.js';

const isProduction = env('TAAND_ENV', 'local') === 'production';
const redisEnabled = Boolean(env('REDIS_URL', ''));
const defaultLevel = env('TAAND_LOG_LEVEL', isProduction ? 'info' : 'debug');

/** Platform services — cache, jobs, mail, logs, events, storage, static assets. */
export default {
  memory: {
    default: env('TAAND_CACHE_STORE', redisEnabled ? 'redis' : (isProduction ? 'file' : 'memory')),
    prefix: env('TAAND_CACHE_PREFIX', ''),
    stores: {
      memory: {
        driver: 'memory',
        maxEntries: Number(env('TAAND_CACHE_MAX_ENTRIES', '1000')),
        maxBytes: Number(env('TAAND_CACHE_MAX_BYTES', String(50 * 1024 * 1024))),
      },
      file: {
        driver: 'file',
        path: 'storage/cache/data',
      },
      redis: {
        driver: 'redis',
        connection: 'cache',
      },
      null: {
        driver: 'null',
      },
    },
  },

  jobs: {
    default: env('QUEUE_CONNECTION', redisEnabled ? 'redis' : (isProduction ? 'database' : 'sync')),
    connections: {
      sync: { driver: 'sync' },
      database: {
        driver: 'database',
        queue: 'default',
        retryAfter: Number(env('QUEUE_RETRY_AFTER', '90')),
      },
      redis: {
        driver: 'redis',
        connection: 'queue',
        queue: 'default',
        retryAfter: Number(env('QUEUE_RETRY_AFTER', '90')),
      },
      array: { driver: 'array' },
      null: { driver: 'null' },
    },
    failed: { table: 'failed_jobs' },
  },

  notify: {
    default: env('MAIL_MAILER', isProduction ? 'failover' : 'array'),
    rateLimit: Number(env('MAIL_RATE_LIMIT', '60')),
    from: {
      address: env('MAIL_FROM_ADDRESS', 'hello@example.com'),
      name: env('MAIL_FROM_NAME', 'TaandJs'),
    },
    mailers: {
      smtp: {
        transport: 'smtp',
        host: env('MAIL_HOST', '127.0.0.1'),
        port: Number(env('MAIL_PORT', '2525')),
        username: env('MAIL_USERNAME', ''),
        password: env('MAIL_PASSWORD', ''),
        secure: env('MAIL_SECURE', 'false') === 'true',
        timeout: Number(env('MAIL_TIMEOUT', '30000')),
      },
      log: { transport: 'log' },
      array: { transport: 'array' },
      file: { transport: 'file', path: 'storage/mail/outbox' },
      null: { transport: 'null' },
      failover: { transport: 'failover', mailers: ['smtp', 'log'] },
    },
  },

  observability: {
    default: env('TAAND_LOG_CHANNEL', 'stack'),
    level: defaultLevel,
    sanitize: [
      'password',
      'password_confirmation',
      'current_password',
      'authorization',
      'cookie',
      'x-api-key',
    ],
    channels: {
      stack: {
        driver: 'stack',
        channels: isProduction ? ['daily'] : ['daily', 'stderr'],
        level: defaultLevel,
      },
      single: {
        driver: 'single',
        path: 'storage/logs/taand.log',
        level: defaultLevel,
        maxBytes: 10 * 1024 * 1024,
      },
      daily: {
        driver: 'daily',
        path: 'storage/logs/taand.log',
        level: defaultLevel,
        days: Number(env('TAAND_LOG_DAYS', '14')),
      },
      stderr: { driver: 'stderr', level: defaultLevel },
      null: { driver: 'null' },
    },
  },

  dispatch: {
    stopOnFailure: env('TAAND_EVENT_STOP_ON_FAILURE', 'false') === 'true',
    maxListeners: Number(env('TAAND_EVENT_MAX_LISTENERS', '100')),
  },

  volumes: {
    default: env('FILESYSTEM_DISK', 'local'),
    disks: {
      local: {
        driver: 'local',
        root: 'storage/uploads',
        url: '/storage',
        visibility: 'public',
      },
      public: {
        driver: 'local',
        root: 'storage/uploads',
        url: '/storage',
        visibility: 'public',
      },
      s3: {
        driver: 's3',
        key: env('AWS_ACCESS_KEY_ID', ''),
        secret: env('AWS_SECRET_ACCESS_KEY', ''),
        region: env('AWS_DEFAULT_REGION', 'us-east-1'),
        bucket: env('AWS_BUCKET', ''),
        url: env('AWS_URL', ''),
        endpoint: env('AWS_ENDPOINT', ''),
        usePathStyleEndpoint: env('AWS_USE_PATH_STYLE_ENDPOINT', 'false') === 'true',
        visibility: 'public',
      },
    },
  },

  static: {
    url: env('TAAND_ASSET_URL', ''),
    version: env('TAAND_ASSET_VERSION', ''),
    storagePrefix: '/storage',
    limits: {
      image: 5 * 1024 * 1024,
      audio: 20 * 1024 * 1024,
      video: 100 * 1024 * 1024,
      document: 10 * 1024 * 1024,
      default: 5 * 1024 * 1024,
    },
    allowed: {
      // SVG omitted — can carry script and enable stored XSS when served inline
      image: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
      audio: ['audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/webm', 'audio/mp4'],
      video: ['video/mp4', 'video/webm', 'video/ogg', 'video/quicktime'],
      document: ['application/pdf', 'text/plain'],
    },
    cache: {
      maxAge: 60 * 60 * 24 * 7,
      immutable: true,
    },
  },
};
