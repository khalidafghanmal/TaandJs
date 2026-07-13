/**
 * User provider — loads users from Prisma.
 */
export class UserProvider {
  constructor(app) {
    this.app = app;
  }

  async findById(id) {
    const numeric = Number(id);
    if (!Number.isInteger(numeric) || numeric < 1) return null;

    const user = await this.app.make('db').user.findUnique({ where: { id: numeric } });
    return user ? this.#sanitize(user) : null;
  }

  async findByEmail(email) {
    if (typeof email !== 'string' || !email) return null;

    const user = await this.app.make('db').user.findUnique({
      where: { email: email.trim().toLowerCase() },
    });

    return user ? this.#sanitize(user) : null;
  }

  async create({ name, email, password, role = 'user' }) {
    const user = await this.app.make('db').user.create({
      data: {
        name: name.trim(),
        email: email.trim().toLowerCase(),
        password,
        role,
      },
    });

    return this.#sanitize(user);
  }

  async updateRememberToken(userId, token) {
    await this.app.make('db').user.update({
      where: { id: userId },
      data: { rememberToken: token },
    });
  }

  #sanitize(user) {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      passwordHash: user.password,
      rememberToken: user.rememberToken ?? null,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }
}
