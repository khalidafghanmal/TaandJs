import { resolveResponse } from '../http/resolveResponse.js';

/**
 * HTTP kernel — config-driven global middleware → router → route middleware.
 */
export class HttpKernel {
  constructor(app) {
    this.app = app;
    this.#globalMiddleware = [];
  }

  #globalMiddleware;

  setGlobalMiddleware(stack) {
    this.#globalMiddleware = [...stack];
    return this;
  }

  use(...middleware) {
    this.#globalMiddleware.push(...middleware);
    return this;
  }

  getGlobalMiddleware() {
    return this.#globalMiddleware;
  }

  async handle(request) {
    request.setAttribute('_startedAt', Date.now());

    const pipeline = this.app.make('pipeline');
    const router = this.app.make('router');

    try {
      return await pipeline.send(request, this.#globalMiddleware, (req) => router.dispatch(req));
    } catch (error) {
      const handler = this.app.make('exceptions');
      const response = await resolveResponse(await handler.render(error, request), this.app);
      return {
        response,
        terminate: async () => {
          const session = request.attribute('_session');
          if (session) {
            this.app.make('session').commit(session, response);
          }
        },
      };
    }
  }
}
