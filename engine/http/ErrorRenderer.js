import { Response } from './Response.js';

/**
 * Renders HTML error pages or JSON for API clients.
 */
export class ErrorRenderer {
  constructor(app) {
    this.app = app;
  }

  wantsHtml(request) {
    if (!request) return true;
    if (request.attribute('_wantsJson')) return false;
    if (request.path?.startsWith('/api')) return false;

    const accept = request.header('accept') ?? '*/*';
    if (accept.includes('application/json') && !accept.includes('text/html') && !accept.includes('*/*')) {
      return false;
    }

    return true;
  }

  meta(status, overrides = {}) {
    const pages = this.app.make('config').get('errors.pages', {});
    const defaults = pages[status] ?? pages[500] ?? {
      title: 'Error',
      message: 'An error occurred.',
    };

    return {
      code: status,
      title: overrides.title ?? defaults.title,
      message: overrides.message ?? defaults.message,
      hint: overrides.hint ?? defaults.hint ?? null,
    };
  }

  async renderHtml(status, overrides = {}) {
    const data = this.meta(status, overrides);

    if (!this.app.has('view')) {
      return `${data.code} ${data.title}\n${data.message}`;
    }

    return this.app.make('view').render('errors.error', data);
  }

  async respond(request, status, overrides = {}) {
    const headers = overrides.headers ?? {};
    const data = this.meta(status, overrides);

    if (!this.wantsHtml(request)) {
      const body = { message: data.message, status: data.code };
      if (overrides.errors) body.errors = overrides.errors;
      return new Response(JSON.stringify(body), status, {
        'Content-Type': 'application/json; charset=utf-8',
        ...headers,
      });
    }

    const html = await this.renderHtml(status, overrides);
    return new Response(html, status, {
      'Content-Type': 'text/html; charset=utf-8',
      ...headers,
    });
  }
}
