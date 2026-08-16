import { spawn } from 'node:child_process';

function toBin(name) {
  if (process.platform === 'win32') return `${name}.cmd`;
  return name;
}

export async function runExternal(command, args, { cwd = process.cwd(), env = process.env } = {}) {
  await new Promise((resolve, reject) => {
    const child = spawn(toBin(command), args, { cwd, env, stdio: 'inherit' });
    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`[Taand] Command failed: ${command} ${args.join(' ')} (exit ${code})`));
    });
  });
}

