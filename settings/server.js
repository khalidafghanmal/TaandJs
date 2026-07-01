import { env } from '../engine/core/Env.js';

/** Production HTTP server tuning. */
export default {
  host: env('TAAND_HOST', '127.0.0.1'),
  port: Number(env('TAAND_SERVER_PORT', '8000')),
  openBrowser: env('TAAND_OPEN_BROWSER', env('TAAND_ENV', 'local') === 'production' ? 'false' : 'true') !== 'false',
  timeout: Number(env('TAAND_SERVER_TIMEOUT', '30000')),
  keepAliveTimeout: Number(env('TAAND_KEEP_ALIVE_TIMEOUT', '65000')),
  headersTimeout: Number(env('TAAND_HEADERS_TIMEOUT', '66000')),
  maxConnections: Number(env('TAAND_MAX_CONNECTIONS', '1000')),
  gracefulShutdownMs: Number(env('TAAND_SHUTDOWN_TIMEOUT', '30000')),
  healthPath: env('TAAND_HEALTH_PATH', '/up'),
};
