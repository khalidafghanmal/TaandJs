import http from 'node:http';
import { pathToFileURL } from 'node:url';
import { LiveReload } from '../dev/LiveReload.js';
import { DevConsole } from './DevConsole.js';
import { HttpRequestHandler } from './HttpRequestHandler.js';
import { openBrowser } from './openBrowser.js';

const HOST = '127.0.0.1';

/**
 * Development HTTP server with live reload and safe defaults.
 */
export class DevServer {
  constructor(app, { ports, host = HOST } = {}) {
    this.app = app;
    const config = app.make('config');
    this.ports = ports ?? [config.get('app.port', 2977), config.get('app.fallbackPort', 1893)];
    this.host = host;
    this.#liveReload = new LiveReload(app);
    app.instance('liveReload', this.#liveReload);
    this.#handler = new HttpRequestHandler(app, {
      transformResponse: (response) => {
        if (
          this.#liveReload.enabled &&
          response?.headers?.['Content-Type']?.includes('text/html')
        ) {
          return this.#liveReload.inject(response.body);
        }
        return response.body;
      },
    });
    this.#server = null;
    this.#stopping = false;
  }

  #server;
  #liveReload;
  #handler;
  #stopping;

  async start() {
    const port = await this.#findAvailablePort();
    this.#server = http.createServer((req, res) => this.#handle(req, res));

    await new Promise((resolve, reject) => {
      this.#server.once('error', reject);
      this.#server.listen(port, this.host, resolve);
    });

    this.#liveReload.start();

    const url = `http://${this.host}:${port}`;
    const openBrowserEnabled = this.app.make('config').get('app.openBrowser', true);

    DevConsole.printStartup({
      url,
      liveReload: this.#liveReload.enabled,
      version: process.env.npm_package_version ?? '0.1.0',
    });

    if (openBrowserEnabled) {
      openBrowser(url);
    }

    return { host: this.host, port, url };
  }

  async stop() {
    if (this.#stopping) return;
    this.#stopping = true;

    this.#liveReload.stop();

    if (this.#server) {
      await new Promise((resolve, reject) => {
        this.#server.close((err) => (err ? reject(err) : resolve()));
      });
      this.#server = null;
    }
  }

  async #handle(rawReq, rawRes) {
    if (this.#liveReload.isLiveRequest(HttpRequestHandler.sanitizePath(rawReq.url))) {
      this.#liveReload.handleLiveRequest(rawReq, rawRes);
      return;
    }

    await this.#handler.handle(rawReq, rawRes, { stopping: this.#stopping });
  }

  static sanitizePath(url) {
    return HttpRequestHandler.sanitizePath(url);
  }

  async #findAvailablePort() {
    for (const port of this.ports) {
      if (await DevServer.isPortFree(port, this.host)) {
        return port;
      }
    }
    throw new Error(`[Taand] Ports ${this.ports.join(', ')} are all in use`);
  }

  static isPortFree(port, host) {
    return new Promise((resolve) => {
      const tester = http.createServer();
      tester.once('error', () => resolve(false));
      tester.once('listening', () => tester.close(() => resolve(true)));
      tester.listen(port, host);
    });
  }
}

export function resolvePath(filePath) {
  return pathToFileURL(filePath).href;
}
