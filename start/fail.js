import { HttpError } from '../engine/http/HttpError.js';

const DEFAULT_MESSAGES = {
  400: 'Bad Request',
  401: 'Unauthorized',
  403: 'Forbidden',
  404: 'Not Found',
  405: 'Method Not Allowed',
  422: 'Unprocessable Entity',
  429: 'Too Many Requests',
  500: 'Internal Server Error',
};

/**
 * Stop request with HTTP error — fail(404) or fail(403, 'Nope')
 */
export default function fail(status = 500, message) {
  const resolved = message ?? DEFAULT_MESSAGES[status] ?? 'Error';
  throw new HttpError(resolved, status);
}
