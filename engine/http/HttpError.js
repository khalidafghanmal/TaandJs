/**
 * HTTP error with status code — thrown in middleware, handlers, and request parsing.
 */
export class HttpError extends Error {
  constructor(message, status = 500, code = null) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.code = code;
  }

  static badRequest(message = 'Bad Request') {
    return new HttpError(message, 400, 'BAD_REQUEST');
  }

  static forbidden(message = 'Forbidden') {
    return new HttpError(message, 403, 'FORBIDDEN');
  }

  static notFound(message = 'Not Found') {
    return new HttpError(message, 404, 'NOT_FOUND');
  }

  static payloadTooLarge(message = 'Payload Too Large') {
    return new HttpError(message, 413, 'PAYLOAD_TOO_LARGE');
  }

  static tooManyRequests(message = 'Too Many Requests') {
    return new HttpError(message, 429, 'TOO_MANY_REQUESTS');
  }

  static unprocessable(message = 'The given data was invalid.') {
    return new HttpError(message, 422, 'VALIDATION_ERROR');
  }
}
