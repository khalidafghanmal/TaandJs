import { getProjectRoot } from '../../utils/project.js';
import { runExternal } from '../../utils/spawn.js';

export class MigrateCommand {
  name = 'migrate';
  description = 'Run database migrations (Prisma)';
  usage = 'migrate';
  examples = ['Taand migrate'];

  async run() {
    const root = getProjectRoot();
    await runExternal('npx', ['prisma', 'migrate', 'dev'], { cwd: root });
  }
}

