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
 * @property {string} [id]
 */

/**
 * @typedef {object} DaemonResponse
 * @property {string} id
 * @property {number} exitCode
 * @property {string} stdout
 * @property {string} stderr
 */

export function defaultSocketPath() {
  if (process.platform === 'win32') {
    return '\\\\.\\pipe\\taand-cli';
  }
  return '/tmp/taand-cli.sock';
}

export function encodeMessage(payload) {
  return `${JSON.stringify(payload)}\n`;
}

export function decodeMessages(buffer) {
  const lines = String(buffer).split('\n').filter(Boolean);
  return lines.map((line) => JSON.parse(line));
}
