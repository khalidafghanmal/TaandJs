import { app } from './app.js';

/**
 * Validate request input — taand-style rules (supports async DB rules).
 *
 *   const data = await validate(req, {
 *     email: 'required|email|unique:user,email',
 *   });
 */
export default async function validate(request, rules, messages = {}, attributes = {}) {
  return app.make('validator').validateRequest(request, rules, messages, attributes);
}

/**
 * Validate a plain object (no request).
 */
export async function validator(data, rules, messages = {}, attributes = {}) {
  return app.make('validator').make(data, rules, messages, attributes);
}
