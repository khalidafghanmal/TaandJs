import { env } from '../engine/core/Env.js';

/** Core runtime — app identity, environment, and dev tooling. */
export default {
  name: env('TAAND_NAME', 'TaandJs'),
  debug: env('TAAND_DEBUG', 'true') !== 'false',
  env: env('TAAND_ENV', 'local'),
  port: Number(env('TAAND_PORT', '2977')),
  fallbackPort: Number(env('TAAND_FALLBACK_PORT', '1893')),
  hotReload: env('TAAND_HOT_RELOAD', 'true') !== 'false',
  openBrowser: env('TAAND_OPEN_BROWSER', 'true') !== 'false',
  key: env('TAAND_APP_KEY', 'change-this-to-a-random-32-char-string'),
  url: env('TAAND_APP_URL', ''),

  /** Machine-to-machine API credential (prefer per-user tokens in production). */
  apiToken: env('TAAND_API_TOKEN', ''),
  allowMachineToken: env('TAAND_ALLOW_MACHINE_TOKEN', 'false') === 'true',

  /** IPs allowed to set X-Forwarded-For (comma-separated). */
  trustedProxies: env('TAAND_TRUSTED_PROXIES', '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),

  /** Optional secret for /__Taand/* dev dashboards. */
  devDashboardKey: env('TAAND_DEV_DASHBOARD_KEY', ''),

  modules: {
    enabled: env('TAAND_MODULES', 'true') !== 'false',
    autoRoutes: env('TAAND_MODULES_AUTO_ROUTES', 'true') !== 'false',
  },
};
