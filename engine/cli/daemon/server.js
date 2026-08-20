import net from 'node:net';
import { TemplateEngine } from '../generator/TemplateEngine.js';
import { GENERATOR_STUB_NAMES } from '../generator/definitions.js';
import { clearConfigCache } from '../cache/ConfigCache.js';
import { clearRouteCache } from '../cache/RouteCache.js';
import { runMakeCommand } from '../generator/runGenerator.js';
import { isMakeCommand } from '../generator/runGenerator.js';
import {
  MessageType,
  defaultSocketPath,
  decodeMessages,
  encodeMessage,
  SOCKET_ENV,
} from './protocol.js';

/**
 * Long-lived CLI worker — preloads templates for sub-second generators.
 * Start with: TAAND_CLI_DAEMON=1 node bin/taand.js daemon
 */
export class CliDaemonServer {
  constructor(options = {}) {
    this.#socketPath = options.socketPath ?? process.env[SOCKET_ENV] ?? defaultSocketPath();
  }

  #socketPath;
  #server = null;

  preload() {
    TemplateEngine.preload(GENERATOR_STUB_NAMES);
    TemplateEngine.preload(['module-routes']);
  }

  start() {
    this.preload();

    this.#server = net.createServer((socket) => {
      let buffer = '';

      socket.on('data', async (chunk) => {
        buffer += chunk.toString();
        const messages = decodeMessages(buffer);
        if (!messages.length) return;

        buffer = buffer.includes('\n') ? buffer.slice(buffer.lastIndexOf('\n') + 1) : '';

        for (const message of messages) {
          const response = await this.#handle(message);
          socket.write(encodeMessage(response));
        }
      });
    });

    return new Promise((resolve, reject) => {
      this.#server.listen(this.#socketPath, () => resolve(this.#socketPath));
      this.#server.on('error', reject);
    });
  }

  async #handle(message) {
    const id = message.id ?? '0';

    if (message.type === MessageType.PING) {
      return { id, exitCode: 0, stdout: 'pong\n', stderr: '' };
    }

    if (message.type === MessageType.PRELOAD) {
      this.preload();
      clearConfigCache();
      clearRouteCache();
      return { id, exitCode: 0, stdout: '[Taand] Daemon preloaded\n', stderr: '' };
    }

    if (message.type === MessageType.SHUTDOWN) {
      this.stop();
      return { id, exitCode: 0, stdout: '[Taand] Daemon stopped\n', stderr: '' };
    }

    if (message.type === MessageType.RUN && Array.isArray(message.argv)) {
      return this.#runArgv(message.argv, id);
    }

    return { id, exitCode: 1, stdout: '', stderr: `[Taand] Unknown daemon message type: ${message.type}\n` };
  }

  async #runArgv(argv, id) {
    const chunks = { stdout: '', stderr: '' };
    const stdout = process.stdout.write.bind(process.stdout);
    const stderr = process.stderr.write.bind(process.stderr);

    process.stdout.write = (s) => {
      chunks.stdout += String(s);
      return true;
    };
    process.stderr.write = (s) => {
      chunks.stderr += String(s);
      return true;
    };

    let exitCode = 0;
    try {
      const cmd = argv[0];
      if (isMakeCommand(cmd)) {
        const result = runMakeCommand(argv);
        if (result?.ok === false) exitCode = process.exitCode ?? 1;
      } else {
        chunks.stderr += `[Taand] Daemon only handles make:* commands currently\n`;
        exitCode = 1;
      }
    } catch (err) {
      chunks.stderr += `${err.message}\n`;
      exitCode = 1;
    } finally {
      process.stdout.write = stdout;
      process.stderr.write = stderr;
    }

    return { id, exitCode, stdout: chunks.stdout, stderr: chunks.stderr };
  }

  stop() {
    this.#server?.close();
    this.#server = null;
  }
}
