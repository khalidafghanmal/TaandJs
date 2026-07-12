/**
 * Thrown when validation fails — Taand's ValidationException equivalent.
 */
export class ValidationError extends Error {
  constructor(errors, message = 'The given data was invalid.') {
    super(message);
    this.name = 'ValidationError';
    this.status = 422;
    this.code = 'VALIDATION_ERROR';
    this.errors = errors;
  }

  first(field) {
    return this.errors[field]?.[0] ?? null;
  }
}
