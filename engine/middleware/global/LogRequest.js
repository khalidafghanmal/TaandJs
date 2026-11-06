import { Middleware } from '../Middleware.js';

/**
 * Logs each request with structured context — uses the log system when available.
 */
export class LogRequest extends Middleware {
  async handle(request, next) {
    request.setAttribute('_startedAt', Date.now());

    if (this.app.has('log')) {
      this.app.make('log').setRequestContext(LogRequest.#context(request));
    } else {
      const time = new Date().toISOString();
      console.log(`  ${time}  ${request.method} ${request.path}`);
    }

    return next(request);
  }

  async terminate(request, response) {
    const ms = Date.now() - (request.attribute('_startedAt') ?? Date.now());

    if (this.app.has('log')) {
      const log = this.app.make('log');
      // terminate() runs after the request's async context has ended, so set it again.
      log.setRequestContext(LogRequest.#context(request));
      log.info('Request completed', { status: response.status, ms });
      log.clearRequestContext();
      return;
    }

    if (process.env.TAAND_ENV === 'production') return;
    console.log(`  → ${response.status} (${ms}ms)`);
  }

  static #context(request) {
    return { ip: request.ip(), method: request.method, path: request.path };
  }
}
