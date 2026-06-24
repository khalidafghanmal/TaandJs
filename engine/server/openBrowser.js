import { spawn } from 'node:child_process';

/**
 * Open a URL in the system default browser (dev-friendly, cross-platform).
 */
export function openBrowser(url) {
  if (!url || process.env.TAAND_OPEN_BROWSER === 'false') {
    return;
  }

  if (!process.stdin.isTTY && process.env.TAAND_OPEN_BROWSER !== 'true') {
    return;
  }

  const platform = process.platform;
  let command;
  let args;

  if (platform === 'win32') {
    command = 'cmd';
    args = ['/c', 'start', '', url];
  } else if (platform === 'darwin') {
    command = 'open';
    args = [url];
  } else {
    command = 'xdg-open';
    args = [url];
  }

  const child = spawn(command, args, { detached: true, stdio: 'ignore', shell: false });
  child.unref();
}
