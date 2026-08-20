import { getProjectRoot } from '../../utils/project.js';
import { runExternal } from '../../utils/spawn.js';

export class DbPushCommand {
  name = 'db:push';
  description = 'Push Prisma schema to the database';
  usage = 'db:push';

  async run() {
    const root = getProjectRoot();
    await runExternal('npx', ['prisma', 'db', 'push'], { cwd: root });
  }
}

