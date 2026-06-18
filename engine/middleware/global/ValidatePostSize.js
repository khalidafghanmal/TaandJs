import { Middleware } from '../Middleware.js';
const MAX_BYTES = 1_048_576;

/**
 * Rejects oversized bodies before handlers run.
 */
export class ValidatePostSize extends Middleware {
  async handle(request, next) {
    const length = Number(request.header('content-length') ?? 0);

    if (length > MAX_BYTES) {
      return this.app.make('errors').respond(request, 413);
    }

    return next(request);
  }
}
