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

  const key = config.get('app.devDashboardKey', '');
  if (key) {
    // Header only: a key in the query string ends up in logs, history and Referer.
    const provided = request.header('x-taand-dev-key') ?? '';
    if (!secureCompare(provided, key)) {
      throw HttpError.forbidden('Invalid dev dashboard key');
    }
  }
}
