/**
 * Base policy class — extend for resource authorization.
 *
 *   export class PostPolicy extends Policy {
 *     update(user, post) {
 *       return user.id === post.userId || user.role === 'admin';
 *     }
 *   }
 */
export class Policy {
  constructor(app) {
    this.app = app;
  }
}
