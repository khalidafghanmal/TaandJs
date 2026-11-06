import { Middleware } from '../Middleware.js';
import { maxBodyBytes } from '../../http/Request.js';

/**
 * Rejects oversized bodies before handlers run.
 */
export class ValidatePostSize extends Middleware {
  async handle(request, next) {
    const length = Number(request.header('content-length') ?? 0);
    const max = maxBodyBytes(this.app.make('config').get('server.maxBodySize'));

    if (length > max) {
      return this.app.make('errors').respond(request, 413);
    }

    return next(request);
  }
}
