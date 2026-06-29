import http from 'node:http';
import { Response } from '../http/Response.js';
import { HttpRequestHandler } from './HttpRequestHandler.js';
import { ProductionConsole } from './ProductionConsole.js';
import { openBrowser } from './openBrowser.js';
import { assertProductionEnv } from '../core/ProductionEnvValidator.js';

/**
 * Production HTTP server — secure, graceful, no dev tooling.
 */
export class ProductionServer {
  constructor(app) {
    this.app = app;
    const config = app.make('config').get('server', {});

    this.host = config.host ?? '127.0.0.1';
    this.port = config.port ?? 8000;
    this.#openBrowser = config.openBrowser ?? false;
    this.#healthPath = config.healthPath ?? '/up';
    this.#timeout = config.timeout ?? 30_000;
    this.#keepAliveTimeout = config.keepAliveTimeout ?? 65_000;
    this.#headersTimeout = config.headersTimeout ?? 66_000;
    this.#maxConnections = config.maxConnections ?? 1000;
    this.#shutdownTimeout = config.gracefulShutdownMs ?? 30_000;

    this.#handler = new HttpRequestHandler(app);
    this.#server = null;
    this.#stopping = false;
    this.#activeConnections = new Set();
  }

  #handler;
  #server;
  #stopping;
  #healthPath;
  #timeout;
  #keepAliveTimeout;
  #headersTimeout;
  #maxConnections;
  #shutdownTimeout;
  #activeConnections;
  #startedAt = null;
  #openBrowser;

  async start() {
    this.#assertProductionReady();

    this.#server = http.createServer((req, res) => this.#handle(req, res));
    this.#server.keepAliveTimeout = this.#keepAliveTimeout;
    this.#server.headersTimeout = this.#headersTimeout;
    this.#server.maxConnections = this.#maxConnections;

    this.#server.on('connection', (socket) => {
      this.#activeConnections.add(socket);
      socket.on('close', () => this.#activeConnections.delete(socket));
    });

    await new Promise((resolve, reject) => {
      this.#server.once('error', reject);
      this.#server.listen(this.port, this.host, resolve);
    });

    this.#startedAt = Date.now();

    const url = toBrowseUrl(this.host, this.port);

    ProductionConsole.printStartup({
      bind: this.host,
      url,
      env: this.app.make('config').get('app.env', 'production'),
      name: this.app.make('config').get('app.name', 'TaandJs'),
    });

    if (this.#openBrowser) {
      openBrowser(url);
    }

    return { host: this.host, port: this.port, url };
  }

  async stop() {
    if (this.#stopping) return;
    this.#stopping = true;

    ProductionConsole.printStopping();

    await new Promise((resolve) => {
      const timer = setTimeout(() => {
        for (const socket of this.#activeConnections) {
          socket.destroy();
        }
        resolve();
      }, this.#shutdownTimeout);

      this.#server?.close(() => {
        clearTimeout(timer);
        resolve();
      });
    });

    this.#server = null;
    ProductionConsole.printStopped();
  }

  get stopping() {
    return this.#stopping;
  }

  async #handle(rawReq, rawRes) {
    rawReq.setTimeout?.(this.#timeout, () => {
      if (!rawRes.headersSent) {
        rawRes.writeHead(408);
        rawRes.end('Request Timeout');
      }
      rawReq.destroy();
    });

    const safePath = HttpRequestHandler.sanitizePath(rawReq.url);

    if (safePath === this.#healthPath) {
      Response.json({
        status: 'ok',
        uptime: Math.floor((Date.now() - (this.#startedAt ?? Date.now())) / 1000),
      }).send(rawRes);
      return;
    }

    await this.#handler.handle(rawReq, rawRes, { stopping: this.#stopping });
  }

  #assertProductionReady() {
    const appConfig = this.app.make('config').get('app', {});

    if (appConfig.debug && appConfig.env === 'production') {
      console.warn('[Taand] Warning: TAAND_DEBUG=true with TAAND_ENV=production — disable debug in production');
    }

    assertProductionEnv(this.app.make('config'));
  }
}
