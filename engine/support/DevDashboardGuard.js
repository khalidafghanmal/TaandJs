import { HttpError } from '../http/HttpError.js';
import { secureCompare } from './secureCompare.js';

const LOCAL_SOCKET_IPS = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1']);

/**
 * Dev-only dashboard guard — never rely on spoofable X-Forwarded-For alone.
 */
export function assertDevDashboard(app, request) {
  const config = app.make('config');
  const env = config.get('app.env', 'local');

  if (!app.debug || env !== 'local') {
    throw HttpError.notFound();
  }

  const socketIp = request.remoteAddress();
  if (!LOCAL_SOCKET_IPS.has(socketIp)) {
    throw HttpError.forbidden('Dev dashboards are only available from localhost');
  }

  // Flush/retry are plain GET links, so refuse requests another site's page started.
  const fetchSite = request.header('sec-fetch-site');
  if (fetchSite && fetchSite !== 'same-origin' && fetchSite !== 'none') {
    throw HttpError.forbidden('Cross-site requests to dev dashboards are not allowed');
  }

  const key = config.get('app.devDashboardKey', '');
  if (key) {
    const provided =
      request.query.dashboard_key
      ?? request.header('x-taand-dev-key')
      ?? '';
    if (!secureCompare(provided, key)) {
      throw HttpError.forbidden('Invalid dev dashboard key');
    }
  }
}
