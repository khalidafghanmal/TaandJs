import { Middleware } from '../Middleware.js';
import { Response } from '../../http/Response.js';

/**
 * API routes must expect JSON — returns 406 for non-JSON Accept headers on reads.
 */
export class ForceJson extends Middleware {
  handle(request, next) {
    if (request.isMethod('GET', 'HEAD', 'OPTIONS')) {
      const accept = request.header('accept') ?? '*/*';
      if (!accept.includes('application/json') && !accept.includes('*/*')) {
        return Response.json({ message: 'Accept application/json required' }, 406);
      }
    }

    request.setAttribute('_wantsJson', true);
    return next(request);
  }
}
