import net from 'node:net';
import { resolveProjectRoot } from '../../server/resolveRoot.js';
import {
  DAEMON_ENV,
  NO_DAEMON_ENV,
  SOCKET_ENV,
  MessageType,
  defaultSocketPath,
  encodeMessage,
} from './protocol.js';

const CONNECT_TIMEOUT_MS = 50;
const RESPONSE_TIMEOUT_MS = 30_000;

/**
 * Try dispatching to a running CLI daemon (future worker mode).
 * Returns null when daemon is unavailable — caller falls back to cold start.
 */
export function tryDaemonDispatch(argv, { root = resolveProjectRoot(), socketPath } = {}) {
  if (process.env[NO_DAEMON_ENV] === '1' || process.env[NO_DAEMON_ENV] === 'true') {
    return null;
  }

  socketPath ??= process.env[SOCKET_ENV] ?? defaultSocketPath(root);

  return new Promise((resolve) => {
    let sent = false;
    let buffer = '';
    let timer;

    const finish = (result) => {
      clearTimeout(timer);
      client.destroy();
      resolve(result);
    };
    // Once the request is sent the daemon may already have run it, so never fall back to a cold start.
    const fail = (reason) =>
      finish(sent ? { exitCode: 1, stdout: '', stderr: `[Taand] CLI daemon ${reason}\n` } : null);

    const client = net.createConnection({ path: socketPath }, () => {
      clearTimeout(timer);
      timer = setTimeout(() => fail('did not respond'), RESPONSE_TIMEOUT_MS);
      const id = `${Date.now()}-${process.pid}`;
      client.write(encodeMessage({ type: MessageType.RUN, id, argv, root }));
      sent = true;
    });

    timer = setTimeout(() => fail('did not respond'), CONNECT_TIMEOUT_MS);

    client.on('data', (chunk) => {
      buffer += chunk.toString();
      if (!buffer.includes('\n')) return;
      try {
        const line = buffer.trim().split('\n').pop();
        finish(JSON.parse(line));
      } catch {
        fail('sent an invalid response');
      }
    });

    client.on('error', () => fail('connection failed'));
    client.on('close', () => fail('closed the connection'));
  });
}

/** True when this process should act as the long-lived daemon worker. */
export function isDaemonWorker() {
  return process.env[DAEMON_ENV] === '1' || process.env[DAEMON_ENV] === 'true';
}
