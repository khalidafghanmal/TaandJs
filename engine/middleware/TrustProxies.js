import net from 'node:net';
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
      const forwarded = request.header('x-forwarded-for');
      if (forwarded) {
        // Proxies append, so only the rightmost untrusted hop is reliable; entries left of it are client-supplied.
        const hops = forwarded.split(',').map((hop) => normalizeIp(hop.trim()));
        const ip = hops.reverse().find((hop) => !trusted.includes(hop));
        if (ip && net.isIP(ip)) {
          request.setAttribute('_ip', ip);
        }
      }
    }

    return next(request);
  }
}
