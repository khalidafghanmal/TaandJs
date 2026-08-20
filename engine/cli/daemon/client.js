import net from 'node:net';
import {
  DAEMON_ENV,
  NO_DAEMON_ENV,
  SOCKET_ENV,
  MessageType,
  defaultSocketPath,
  encodeMessage,
} from './protocol.js';

const DISPATCH_TIMEOUT_MS = 50;

/**
 * Try dispatching to a running CLI daemon (future worker mode).
 * Returns null when daemon is unavailable — caller falls back to cold start.
 */
export function tryDaemonDispatch(argv) {
  if (process.env[NO_DAEMON_ENV] === '1' || process.env[NO_DAEMON_ENV] === 'true') {
    return null;
  }

  const socketPath = process.env[SOCKET_ENV] ?? defaultSocketPath();

  return new Promise((resolve) => {
    const client = net.createConnection({ path: socketPath }, () => {
      const id = `${Date.now()}-${process.pid}`;
      client.write(
        encodeMessage({
          type: MessageType.RUN,
          id,
          argv,
        }),
      );
    });

    let buffer = '';
    const finish = (result) => {
      client.destroy();
      resolve(result);
    };

    const timer = setTimeout(() => finish(null), DISPATCH_TIMEOUT_MS);

    client.on('data', (chunk) => {
      buffer += chunk.toString();
      if (!buffer.includes('\n')) return;
      clearTimeout(timer);
      try {
        const line = buffer.trim().split('\n').pop();
        const response = JSON.parse(line);
        finish(response);
      } catch {
        finish(null);
      }
    });

    client.on('error', () => {
      clearTimeout(timer);
      finish(null);
    });
  });
}

/** True when this process should act as the long-lived daemon worker. */
export function isDaemonWorker() {
  return process.env[DAEMON_ENV] === '1' || process.env[DAEMON_ENV] === 'true';
}
