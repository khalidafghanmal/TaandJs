import { Request } from '../../engine/http/Request.js';
import { Router } from '../../engine/routing/Router.js';
import { Container } from '../../engine/core/Container.js';
import { Config } from '../../engine/core/Config.js';
import { Pipeline } from '../../engine/middleware/Pipeline.js';
import { ErrorRenderer } from '../../engine/http/ErrorRenderer.js';
import { Validator } from '../../engine/validation/Validator.js';
import { rules } from '../../engine/validation/Rules.js';
import { createDbRules } from '../../engine/validation/DbRules.js';
import { Gate } from '../../engine/auth/Gate.js';
import { MiddlewareRegistry } from '../../engine/middleware/MiddlewareRegistry.js';

/** Sync GET/HEAD request — fast unit tests. */
export function req(path = '/', opts = {}) {
  const url = path.includes('?') ? path : path;
  const raw = {
    method: opts.method ?? 'GET',
    url,
    headers: { host: 'localhost', ...(opts.headers ?? {}) },
    socket: { remoteAddress: opts.ip ?? '127.0.0.1' },
  };
  const r = new Request(raw, { params: opts.params ?? {} });
  for (const [k, v] of Object.entries(opts.attributes ?? {})) r.setAttribute(k, v);
  return r;
}

/** Async request with JSON or form body. */
export async function reqBody(method, path, body, contentType = 'application/json', extraHeaders = {}) {
  const payload = contentType.includes('json') ? JSON.stringify(body) : new URLSearchParams(body).toString();
  const chunks = [Buffer.from(payload)];
  const raw = {
    method,
    url: path,
    headers: { host: 'localhost', 'content-type': contentType, ...extraHeaders },
    socket: { remoteAddress: '127.0.0.1' },
    on(ev, fn) {
      if (ev === 'data') chunks.forEach((c) => fn(c));
      if (ev === 'end') fn();
      return this;
    },
    destroy() {},
  };
  return Request.from(raw);
}

/** Minimal app shell for router / middleware tests. */
export function miniApp(overrides = {}) {
  const app = Object.assign(new Container(), {
    basePath: overrides.basePath ?? process.cwd(),
    debug: false,
  });

  const config = new Config();
  config.merge({
    auth: {
      roles: {
        hierarchy: { admin: 100, editor: 50, user: 10 },
        permissions: { admin: ['*'], editor: ['content.manage'], user: ['profile.edit'] },
      },
    },
    ...(overrides.config ?? {}),
  });

  const errors = new ErrorRenderer(app);
  const pipeline = new Pipeline(app);
  const middleware = overrides.middleware ?? new MiddlewareRegistry();
  const router = new Router();
  router.setApplication(app);
  router.setPipeline(pipeline);
  const validator = new Validator(app, { ...rules, ...createDbRules(app) });
  const gate = new Gate(app);

  app.make = function (name) {
    if (name === 'config') return config;
    if (name === 'errors') return errors;
    if (name === 'pipeline') return pipeline;
    if (name === 'middleware') return middleware;
    if (name === 'router') return router;
    if (name === 'db') return overrides.db ?? {};
    if (name === 'validator') return validator;
    if (name === 'gate') return gate;
    if (name === 'session') return overrides.session ?? { get: () => null, put: () => {} };
    return overrides.handlers?.[name] ?? null;
  };

  app.has = function (name) {
    return ['config', 'errors', 'pipeline', 'middleware', 'router', 'db', 'validator', 'gate', 'session'].includes(name)
      || (overrides.handlers && name in overrides.handlers);
  };

  return { app, router, pipeline, middleware, config, errors, validator, gate };
}

export async function dispatch(router, request) {
  const { response } = await router.dispatch(request);
  return response;
}

export function body(response) {
  try {
    return JSON.parse(response.body);
  } catch {
    return response.body;
  }
}
