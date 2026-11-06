/**
 * Shared HTTP request handling for dev and production servers.
 */
export class HttpRequestHandler {
  constructor(app, { transformResponse = null } = {}) {
    this.app = app;
    this.#transformResponse = transformResponse;
  }

  #transformResponse;

  async handle(rawReq, rawRes, { stopping = false } = {}) {
    if (stopping) {
      const response = await this.app.make('errors').respond(null, 503, {
        message: 'Server is shutting down',
      });
      response.send(rawRes);
      return;
    }

    try {
      const safePath = HttpRequestHandler.sanitizePath(rawReq.url);

      if (safePath === null) {
        const response = await this.app.make('errors').respond(null, 400);
        response.send(rawRes);
        return;
      }

      if (this.app.has('static')) {
        const staticFile = this.app.make('static').tryServe(safePath);
        if (staticFile) {
          staticFile.send(rawRes);
          return;
        }
      }

      const queryAt = rawReq.url?.indexOf('?') ?? -1;
      rawReq.url = queryAt === -1 ? safePath : `${safePath}${rawReq.url.slice(queryAt)}`;
      const { response, terminate } = await this.app.handleRequest(rawReq);

      if (this.#transformResponse) {
        response.body = this.#transformResponse(response);
      }

      await terminate?.();
      response.send(rawRes);
    } catch (err) {
      if (this.app.has('exceptions')) {
        const response = await this.app.make('exceptions').render(err, null);
        if (this.#transformResponse) {
          response.body = this.#transformResponse(response);
        }
        response.send(rawRes);
        return;
      }

      const status = err?.status ?? 500;

      if (this.app.has('log')) {
        this.app.make('log').error('HTTP request failed', {
          error: err,
          path: rawReq.url,
          method: rawReq.method,
        });
      }

      const response = await this.app.make('errors').respond(null, status, {
        message: this.app.debug ? err.message : undefined,
      });
      response.send(rawRes);
    }
  }

  static sanitizePath(url) {
    if (!url || typeof url !== 'string') return '/';

    const pathOnly = url.split('?')[0];

    if (pathOnly.includes('..') || pathOnly.includes('\\')) {
      return null;
    }

    if (pathOnly.length > 2048) {
      return null;
    }

    return pathOnly.startsWith('/') ? pathOnly : `/${pathOnly}`;
  }
}
