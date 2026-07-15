import { Seeder } from '../../engine/database/Seeder.js';

export class UserSeeder extends Seeder {
  async run() {
    const email = 'admin@example.com';
    const existing = await this.db().user.findUnique({ where: { email } });

    if (existing) {
      process.stdout.write('[Taand] UserSeeder: admin user already exists — skipped\n');
      return;
    }

    const password = await this.hasher().hash('password');

    await this.db().user.create({
      data: {
        name: 'Admin',
        email,
        password,
        role: 'admin',
      },
    });

    process.stdout.write('[Taand] UserSeeder: created admin@example.com (password: password)\n');
  }
}

export default UserSeeder;
