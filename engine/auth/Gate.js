/**
 * Authorization gate — Taand Gate equivalent with role permissions.
 */
export class Gate {
  constructor(app) {
    this.app = app;
    this.#abilities = new Map();
    this.#policies = new Map();
    this.#registerDefaults();
  }

  #abilities;
  #policies;

  define(ability, callback) {
    this.#abilities.set(ability, callback);
    return this;
  }

  policy(model, PolicyClass) {
    this.#policies.set(model, PolicyClass);
    return this;
  }

  async allows(ability, user, ...args) {
    if (!user) return false;

    if (this.#abilities.has(ability)) {
      const result = await this.#abilities.get(ability)(user, ...args);
      return Boolean(result);
    }

    if (this.#roleAllows(ability, user.role)) {
      return true;
    }

    const resource = args[0];
    if (resource && typeof resource === 'object') {
      const model = resource.constructor?.name ?? null;
      const Policy = model ? this.#policies.get(model) : null;

      if (Policy) {
        const instance = new Policy(this.app);
        const method = this.#policyMethod(ability);

        // Skip inherited Object members (toString, valueOf, constructor…) — they would answer truthy.
        if (typeof instance[method] === 'function' && !(method in Object.prototype)) {
          return Boolean(await instance[method](user, resource, ...args.slice(1)));
        }
      }
    }

    return false;
  }

  async denies(ability, user, ...args) {
    return !(await this.allows(ability, user, ...args));
  }

  async authorize(ability, user, ...args) {
    if (!(await this.allows(ability, user, ...args))) {
      const error = new Error('This action is unauthorized.');
      error.status = 403;
      error.code = 'FORBIDDEN';
      throw error;
    }
  }

  #policyMethod(ability) {
    return ability.replace(/[-.](\w)/g, (_, c) => c.toUpperCase());
  }

  #roleAllows(ability, role) {
    const config = this.app.make('config').get('auth.roles', {});
    const permissions = config.permissions && Object.hasOwn(config.permissions, role)
      ? config.permissions[role]
      : [];

    if (permissions.includes('*')) return true;
    return permissions.includes(ability);
  }

  #registerDefaults() {
    this.define('admin', (user) => user.role === 'admin');

    this.define('editor', (user) => user.role === 'admin' || user.role === 'editor');

    this.define('manage-users', (user) => user.role === 'admin');

    this.define('view-admin', (user) => {
      const hierarchy = this.app.make('config').get('auth.roles.hierarchy', {});
      return (hierarchy[user.role] ?? 0) >= (hierarchy.admin ?? 100);
    });
  }
}
