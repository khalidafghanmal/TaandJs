import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Top-level template entries that never belong in a new app. */
const EXCLUDE_ROOT = new Set([
  'node_modules',
  'dist',
  'starter',
  'packages',
  '.git',
  '.github',
  '.worktrees',
]);

const EXCLUDE_FILES = new Set(['.env']);

const EXCLUDE_PREFIXES = [
  'storage/logs/',
  'storage/database/',
  'storage/view-cache/',
  'storage/cli-cache/',
  'storage/cache/data/',
  'storage/sessions/',
  'storage/mail/outbox/',
];

/**
 * @param {string} relPath path relative to the template root
 * @param {boolean} isDir
 */
export function shouldSkip(relPath, isDir) {
  const normalized = relPath.replace(/\\/g, '/');
  if (EXCLUDE_ROOT.has(normalized.split('/')[0])) return true;
  if (!isDir && EXCLUDE_FILES.has(path.posix.basename(normalized))) return true;
  return EXCLUDE_PREFIXES.some((p) => normalized.startsWith(p));
}

async function copyTemplate(src, dest, root = src) {
  await fs.mkdir(dest, { recursive: true });
  const entries = await fs.readdir(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    if (shouldSkip(path.relative(root, srcPath), entry.isDirectory())) continue;

    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      await copyTemplate(srcPath, destPath, root);
    } else {
      await fs.copyFile(srcPath, destPath);
    }
  }
}

function run(cmd, args, cwd) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { cwd, stdio: 'inherit', shell: process.platform === 'win32' });
    child.on('error', reject);
    child.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`Exit ${code}`))));
  });
}

/**
 * @param {string} targetDir
 * @param {{ templateRoot?: string | null, install?: boolean }} options
 */
export async function createProject(targetDir, { templateRoot = null, install = true } = {}) {
  const root = templateRoot ?? path.resolve(__dirname, '..', 'template');
  const dest = path.resolve(process.cwd(), targetDir);

  try {
    await fs.access(dest);
    throw new Error(`Directory already exists: ${dest}`);
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;
  }

  console.log(`[create-taand] Scaffolding → ${dest}`);
  await copyTemplate(root, dest);

  const envExample = path.join(dest, '.env.example');
  const envFile = path.join(dest, '.env');
  try {
    await fs.copyFile(envExample, envFile);
  } catch {
    console.warn('[create-taand] No .env.example found — create .env manually.');
  }

  if (install) {
    console.log('[create-taand] Running npm install…');
    await run('npm', ['install'], dest);

    console.log('[create-taand] Running migrations…');
    try {
      await run('npm', ['run', 'db:migrate:prod'], dest);
    } catch {
      console.warn('[create-taand] Migration skipped — start Postgres (npm run docker:up) then: npm run db:migrate:prod');
    }
  }

  console.log('');
  console.log('  Done! Next steps:');
  console.log(`    cd ${path.basename(dest)}`);
  console.log('    npm run docker:up          # Postgres + Redis (if not already running)');
  console.log('    npm run db:migrate:prod    # if migrations were skipped');
  console.log('    npm run dev');
  console.log('');
}
