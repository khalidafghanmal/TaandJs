import { Middleware } from '../Middleware.js';

/**
 * Trims whitespace from string input — runs before handlers read req.input().
 */
export class TrimInput extends Middleware {
  handle(request, next) {
    request.sanitize();
    return next(request);
  }
}
