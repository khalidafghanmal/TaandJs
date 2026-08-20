import { getProjectRoot } from '../../utils/project.js';
import { runExternal } from '../../utils/spawn.js';

export class DbStudioCommand {
  name = 'db:studio';
  description = 'Open Prisma Studio';
  usage = 'db:studio';

  async run() {
    const root = getProjectRoot();
    await runExternal('npx', ['prisma', 'studio'], { cwd: root });
  }
}

