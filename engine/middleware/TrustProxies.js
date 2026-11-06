import { Middleware } from './Middleware.js';

function normalizeIp(ip) {
  if (!ip) return '';
  return ip.startsWith('::ffff:') ? ip.slice(7) : ip;
}

/**
 * Trust X-Forwarded-For only when the direct connection is from a configured proxy.
 */
export class TrustProxies extends Middleware {
  handle(request, next) {
    const remote = normalizeIp(request.remoteAddress());
    const trusted = this.app.make('config').get('app.trustedProxies', []);

    if (Array.isArray(trusted) && trusted.length > 0 && trusted.includes(remote)) {
      // The last value is the one our proxy set; earlier ones may come from the client.
      const proto = request.header('x-forwarded-proto')?.split(',').pop().trim().toLowerCase();
      if (proto === 'https') {
        request.setAttribute('_secure', true);
      }

      const forwarded = request.header('x-forwarded-for');
      if (forwarded) {
        const ip = forwarded.split(',')[0].trim();
        if (ip) {
          request.setAttribute('_ip', ip);
        }
      }
    }

    return next(request);
  }
}
