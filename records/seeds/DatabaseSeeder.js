import { Seeder } from '../../engine/database/Seeder.js';
import { UserSeeder } from './UserSeeder.js';

export class DatabaseSeeder extends Seeder {
  async run() {
    await this.call(UserSeeder);
  }
}

export default DatabaseSeeder;
