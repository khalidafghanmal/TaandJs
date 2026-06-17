import { Response } from '../http/Response.js';
import { resolveResponse } from '../http/resolveResponse.js';

/**
 * Middleware pipeline — onion execution with terminable hooks.
 * Middleware authors always receive and return Response via next().
 */
export class Pipeline {
  constructor(app) {
    this.app = app;
  }

  async send(request, middleware, destination, terminable = [], without = []) {
    const registry = this.app.make('middleware');
    const stack = registry.expand(middleware, without);
    let index = 0;

    const next = async (req) => {
      if (index >= stack.length) {
        const outcome = await Pipeline.#resolveDestination(destination, req);
        if (outcome.terminate) {
          terminable.push(outcome.terminate);
        }
        return outcome.response;
      }

      const layer = stack[index++];
      const { handle, instance } = registry.create(layer, this.app);

      if (instance) {
        terminable.push((requestArg, responseArg) => instance.terminate(requestArg, responseArg));
      }

      const response = await handle(req, next);

      if (!(response instanceof Response)) {
        throw new TypeError('[Taand] Middleware must return a Response');
      }

      return response;
    };

    let response;

    try {
      response = await next(request);
    } catch (error) {
      if (!this.app.has('exceptions')) throw error;

      const handler = this.app.make('exceptions');
      response = await resolveResponse(await handler.render(error, request), this.app);
    }

    return {
      response,
      terminate: async () => {
        for (const fn of [...terminable].reverse()) {
          await fn(request, response);
        }
      },
    };
  }

  static async #resolveDestination(destination, request) {
    const result = await destination(request);

    if (result?.response instanceof Response) {
      return { response: result.response, terminate: result.terminate ?? null };
    }

    if (result instanceof Response) {
      return { response: result, terminate: null };
    }

    throw new TypeError('[Taand] Route handler must return a Response or { response, terminate }');
  }
}
