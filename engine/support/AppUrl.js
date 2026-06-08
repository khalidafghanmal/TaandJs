import { Redirect } from '../http/Redirect.js';

/**
 * Build absolute application URLs from TAAND_APP_URL + sanitized relative path.
 */
export function appUrl(path = '/', baseUrl = null) {
  const relative = sanitizePathInput(path);
  const base = normalizeBaseUrl(baseUrl);

  if (!base) {
    return relative;
  }

  return new URL(relative, base).toString();
}

export function appUrlFromConfig(config, path = '/') {
  const app = config?.get?.('app') ?? config ?? {};
  const server = config?.get?.('server') ?? {};
  const configured = app.url ?? app.appUrl ?? null;

  if (configured) {
    return appUrl(path, configured);
  }

  const host = server.host ?? '127.0.0.1';
  const port = server.port ?? app.port ?? 2977;
  const browseHost = host === '0.0.0.0' || host === '::' ? '127.0.0.1' : host;
  const scheme = app.env === 'production' ? 'https' : 'http';
  const fallback = `${scheme}://${browseHost}:${port}`;

  return appUrl(path, fallback);
}

function sanitizePathInput(path) {
  if (typeof path !== 'string') {
    throw new Error('[Taand] appUrl() path must be a string');
  }

  const trimmed = path.trim();
  if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed)) {
    throw new Error('[Taand] appUrl() rejects absolute URLs — pass a relative path starting with /');
  }

  return Redirect.sanitize(trimmed.startsWith('/') ? trimmed : `/${trimmed}`);
}

function normalizeBaseUrl(baseUrl) {
  if (!baseUrl || typeof baseUrl !== 'string') return null;
  const trimmed = baseUrl.trim().replace(/\/+$/, '');
  if (!trimmed) return null;
  return `${trimmed}/`;
}
