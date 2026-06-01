const PLACEHOLDER_APP_KEY = 'change-this-to-a-random-32-char-string';
const PLACEHOLDER_DB =
  'postgresql://postgres:postgres@127.0.0.1:5432/taand?schema=public';

/**
 * Fail fast when production env is unsafe or incomplete.
 */
export function assertProductionEnv(config) {
  const app = config.get('app', {});
  const database = config.get('database', {});
  const auth = config.get('auth', {});

  if (app.key === PLACEHOLDER_APP_KEY || !app.key?.trim()) {
    throw new Error('[Taand] Set TAAND_APP_KEY before running the production server');
  }

  if (app.env === 'production' && app.debug) {
    throw new Error('[Taand] TAAND_DEBUG must be false when TAAND_ENV=production');
  }

  const machineToken =
    auth.tokens?.fallback
    || app.apiToken
    || '';

  if (app.env === 'production' && machineToken && !app.allowMachineToken) {
    throw new Error(
      '[Taand] TAAND_API_TOKEN is blocked in production — use personal access tokens, '
      + 'or set TAAND_ALLOW_MACHINE_TOKEN=true with explicit TAAND_MACHINE_ABILITIES',
    );
  }

  const url = database.url?.trim();
  if (!url) {
    throw new Error('[Taand] Set DATABASE_URL before running the production server');
  }

  if (url === PLACEHOLDER_DB && app.env === 'production') {
    throw new Error('[Taand] DATABASE_URL still uses the example value — set a real database URL');
  }

  if (!url.startsWith('postgresql://') && !url.startsWith('postgres://')) {
    console.warn('[Taand] Warning: DATABASE_URL is not PostgreSQL — ensure this is intentional');
  }

  const cors = config.get('cors', {});
  const origins = cors.allowedOrigins ?? [];
  if (cors.supportsCredentials && origins.includes('*')) {
    throw new Error(
      '[Taand] CORS_SUPPORTS_CREDENTIALS cannot be used with CORS_ALLOWED_ORIGINS=* — '
      + 'list explicit origins instead',
    );
  }
}
