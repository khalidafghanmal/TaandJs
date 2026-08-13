import { app } from './app.js';
import user from './user.js';
import { currentRequest } from '../engine/support/RequestContext.js';

/**
 * Authorization helpers — fail closed when unauthenticated.
 */
export async function can(ability, ...args) {
  const req = currentRequest();
  const authUser = user(req);
  if (!authUser) return false;
  return app.make('gate').allows(ability, authUser, ...args);
}

export async function authorize(ability, ...args) {
  const req = currentRequest();
  const authUser = user(req);
  if (!authUser) {
    const error = new Error('This action is unauthorized.');
    error.status = 403;
    error.code = 'FORBIDDEN';
    throw error;
  }
  return app.make('gate').authorize(ability, authUser, ...args);
}

export default can;
