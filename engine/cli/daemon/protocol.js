import crypto from 'node:crypto';
import os from 'node:os';
import path from 'node:path';

/** CLI daemon wire protocol — for future near-instant command dispatch. */

export const DAEMON_ENV = 'TAAND_CLI_DAEMON';
export const SOCKET_ENV = 'TAAND_CLI_SOCKET';
export const NO_DAEMON_ENV = 'TAAND_CLI_NO_DAEMON';

export const MessageType = {
  RUN: 'run',
  PING: 'ping',
  PRELOAD: 'preload',
  SHUTDOWN: 'shutdown',
};

/**
 * @typedef {object} DaemonRequest
 * @property {string} type
 * @property {string[]} [argv]
 * @property {string} [root] project root the client runs in (required for RUN)
 * @property {string} [id]
 */

/**
 * @typedef {object} DaemonResponse
 * @property {string} id
 * @property {number} exitCode
 * @property {string} stdout
 * @property {string} stderr
 */

/** Comparable form of a project root (Windows paths are case-insensitive). */
export function normalizeRoot(root) {
  const resolved = path.resolve(root);
  return process.platform === 'win32' ? resolved.toLowerCase() : resolved;
}

/** One socket/pipe per project root and user, so a daemon never serves another project. */
export function defaultSocketPath(root) {
  const user = process.platform === 'win32' ? (process.env.USERNAME ?? '') : String(process.getuid());
  const hash = crypto
    .createHash('sha256')
    .update(`${user}\0${normalizeRoot(root)}`)
    .digest('hex')
    .slice(0, 16);
  if (process.platform === 'win32') {
    return `\\\\.\\pipe\\taand-cli-${hash}`;
  }
  return path.join(os.tmpdir(), `taand-cli-${user}-${hash}.sock`);
}

export function encodeMessage(payload) {
  return `${JSON.stringify(payload)}\n`;
}

export function decodeMessages(buffer) {
  const lines = String(buffer).split('\n').filter(Boolean);
  return lines.map((line) => JSON.parse(line));
}
