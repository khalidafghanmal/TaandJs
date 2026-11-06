import path from 'node:path';
import { FileWatcher } from './FileWatcher.js';
import { ProjectPaths } from '../core/ProjectPaths.js';
import { OVERLAY_CLIENT_JS, OVERLAY_CSS, serializeError } from './ErrorOverlay.js';

const LIVE_PATH = '/_Taand/live';
const LIVE_SCRIPT_PATH = '/_Taand/live.js';
const LIVE_CSS_PATH = '/_Taand/overlay.css';
const HEARTBEAT_MS = 25_000;

/** External script — inline scripts are blocked by the global CSP (default-src 'self'). */
const CLIENT_SCRIPT_TAG = `<script id="taand-live" src="${LIVE_SCRIPT_PATH}" defer></script>`;
const CLIENT_SCRIPT_BODY = `${OVERLAY_CLIENT_JS}
(function(){var s=new EventSource("${LIVE_PATH}");s.onmessage=function(e){if(window.__TAAND_LIVE_MESSAGE__)window.__TAAND_LIVE_MESSAGE__(e.data);else if(e.data==="reload")location.reload()}})();`;

/**
 * Dev-only live reload — SSE push + secure file watching.
 * Disabled automatically outside local environment.
 */
export class LiveReload {
  constructor(app) {
    this.app = app;
    this.#clients = new Set();
  }

  #clients;
  #watcher = null;
  #heartbeat = null;
  #errors = [];

  get enabled() {
    const config = this.app.make('config');
    return config.get('app.env') === 'local' && config.get('app.hotReload', true);
  }

  get livePath() {
    return LIVE_PATH;
  }

  start() {
    if (!this.enabled) return;

    const basePath = this.app.basePath;

    this.#watcher = new FileWatcher(basePath, {
      paths: [
        ProjectPaths.views,
        ProjectPaths.routes,
        ProjectPaths.settings,
        ProjectPaths.controllers,
        ProjectPaths.modules,
      ],
      onChange: (file) => this.#handleChange(file),
    });

    this.#watcher.start();
    this.#heartbeat = setInterval(() => this.#ping(), HEARTBEAT_MS);
  }

  stop() {
    this.#watcher?.stop();
    this.#watcher = null;

    if (this.#heartbeat) {
      clearInterval(this.#heartbeat);
      this.#heartbeat = null;
    }

    for (const client of this.#clients) {
      client.end();
    }
    this.#clients.clear();
  }

  isLiveRequest(url) {
    const pathOnly = url?.split('?')[0];
    return pathOnly === LIVE_PATH || pathOnly === LIVE_SCRIPT_PATH || pathOnly === LIVE_CSS_PATH;
  }

  handleLiveRequest(req, res) {
    const pathOnly = req.url?.split('?')[0];

    if (pathOnly === LIVE_SCRIPT_PATH) {
      this.#handleLiveScript(res);
      return;
    }
    if (pathOnly === LIVE_CSS_PATH) {
      this.#handleLiveCss(res);
      return;
    }
    if (!this.enabled) {
      res.writeHead(404);
      res.end();
      return;
    }

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Content-Type-Options': 'nosniff',
    });

    res.write('data: connected\n\n');
    this.#clients.add(res);

    req.on('close', () => {
      this.#clients.delete(res);
    });
  }

  #handleLiveCss(res) {
    res.writeHead(200, {
      'Content-Type': 'text/css; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      'X-Content-Type-Options': 'nosniff',
    });
    res.end(OVERLAY_CSS);
  }

  #handleLiveScript(res) {
    res.writeHead(200, {
      'Content-Type': 'application/javascript; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      'X-Content-Type-Options': 'nosniff',
    });
    res.end(CLIENT_SCRIPT_BODY);
  }

  inject(html) {
    if (!this.enabled || typeof html !== 'string') return html;
    if (html.includes('id="taand-live"') || html.includes(LIVE_SCRIPT_PATH)) return html;

    if (html.includes('</body>')) {
      return html.replace('</body>', `${CLIENT_SCRIPT_TAG}</body>`);
    }

    return html + CLIENT_SCRIPT_TAG;
  }

  async #handleChange(filePath) {
    const ext = path.extname(filePath);
    const relative = path.relative(this.app.basePath, filePath).replace(/\\/g, '/');

    try {
      if (
        relative.startsWith(ProjectPaths.views)
        || ext === '.taand'
      ) {
        this.app.make('view').flush();
        this.#log('ui', relative);
      } else if (relative.startsWith(`${ProjectPaths.routes}/`)) {
        await this.app.reloadRoutes();
        this.#log('flow', relative);
      } else if (relative.startsWith(`${ProjectPaths.settings}/`)) {
        await this.app.reloadConfig();
        this.#log('config', relative);
      } else if (relative.startsWith(`${ProjectPaths.controllers}/`)) {
        this.app.make('controllers').flush();
        this.#log('actions', relative);
      } else if (relative.startsWith(`${ProjectPaths.modules}/`)) {
        if (path.basename(relative) === 'routes.js') {
          await this.app.reloadRoutes();
        } else {
          this.app.make('controllers').flush();
        }
        this.#log('features', relative);
      } else {
        return;
      }

      this.clearErrors();
      this.#broadcast('reload');
    } catch (error) {
      console.error(`  ✗  hot reload failed: ${error.message}`);
      this.pushError(error);
    }
  }

  pushError(error) {
    const dto = serializeError(error);
    this.#errors.push(dto);
    if (this.#errors.length > 20) this.#errors.shift();
    this.#broadcastJson({ type: 'error', error: dto, errors: [...this.#errors] });
    return dto;
  }

  broadcastErrors(errors) {
    this.#errors = Array.isArray(errors) ? [...errors] : [];
    this.#broadcastJson({ type: 'error', errors: this.#errors });
  }

  clearErrors() {
    this.#errors = [];
    this.#broadcastJson({ type: 'clear-errors' });
  }

  #broadcast(event) {
    for (const client of this.#clients) {
      client.write(`data: ${event}\n\n`);
    }
  }

  #broadcastJson(payload) {
    const data = JSON.stringify(payload);
    for (const client of this.#clients) {
      client.write(`data: ${data}\n\n`);
    }
  }

  #ping() {
    for (const client of this.#clients) {
      client.write(': ping\n\n');
    }
  }

  #log(type, file) {
    console.log(`  ↻  ${type} updated — ${file}`);
  }
}
