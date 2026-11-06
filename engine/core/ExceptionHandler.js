import { Response } from '../http/Response.js';
import { ValidationError } from '../validation/ValidationError.js';
import { HaltError, formatHaltPayload } from '../support/Debug.js';
import { safeBack } from '../support/SafeBack.js';
import { renderOverlayPage, serializeError } from '../dev/ErrorOverlay.js';

/**
 * Central exception handler — Taand's Illuminate\Foundation\Exceptions\Handler.
 */
export class ExceptionHandler {
  constructor(app) {
    this.app = app;
    this.#dontReport = new Set();
    this.#recent = [];
    this.dontReport(ValidationError);
  }

  #dontReport;
  #recent;

  dontReport(...exceptions) {
    for (const ex of exceptions) this.#dontReport.add(ex);
    return this;
  }

  report(error) {
    const shouldLog = ![...this.#dontReport].some((type) => error instanceof type);
    if (!shouldLog) return;

    if (this.app.has('log')) {
      const log = this.app.make('log');
      const status = error?.status ?? 500;
      const level = status >= 500 ? 'error' : 'warning';
      log[level]('Exception reported', {
        error,
        status,
        code: error?.code ?? null,
      });
      return;
    }

    if (this.app.debug) {
      console.error('[Taand]', error);
    }
  }

  async render(error, request) {
    this.report(error);

    if (error instanceof ValidationError) {
      return this.#renderValidationError(error, request);
    }

    if (error instanceof HaltError && this.app.debug) {
      const haltError = new Error(formatHaltPayload(error.payload));
      haltError.name = 'Halt';
      haltError.stack = error.stack;
      return this.#debugOverlay(haltError, 500, request);
    }

    const status = error?.status ?? 500;
    const errors = this.app.make('errors');

    if (status === 401 || error?.code === 'UNAUTHENTICATED') {
      return errors.respond(request, 401);
    }

    if (status === 403 || error?.code === 'FORBIDDEN') {
      return errors.respond(request, 403, { message: error.message });
    }

    if (this.app.debug && status >= 500) {
      return this.#debugOverlay(error, status, request);
    }

    const code = status >= 400 && status < 600 ? status : 500;

    // 5xx messages come from drivers/internals (DB hosts, SQL, file paths) — only show them in debug.
    return errors.respond(request, code, code < 500 || this.app.debug ? { message: error.message } : {});
  }

  #debugOverlay(error, status, request) {
    const errors = this.app.make('errors');
    if (!errors.wantsHtml(request)) {
      return Response.json(
        {
          message: error.message,
          status,
          stack: this.app.debug ? error.stack : undefined,
        },
        status,
      );
    }

    const dto = serializeError(error);
    this.#recent.push(dto);
    if (this.#recent.length > 10) this.#recent.shift();

    // Notify other open tabs via SSE (skip re-serialize into LiveReload queue when possible)
    if (this.app.has('liveReload')) {
      try {
        this.app.make('liveReload').broadcastErrors(this.#recent);
      } catch {
        /* optional in CLI / tests */
      }
    }

    return new Response(renderOverlayPage(this.#recent), status, {
      'Content-Type': 'text/html; charset=utf-8',
    });
  }

  async #renderValidationError(error, request) {
    const errors = this.app.make('errors');

    if (!errors.wantsHtml(request)) {
      return Response.json(
        { message: error.message, errors: error.errors },
        422,
      );
    }

    const session = request?.attribute('_session');
    if (session) {
      const store = this.app.make('session');
      store.flash(session, 'errors', error.errors);
      store.flash(session, 'old', request.all());
    }

    return safeBack(request, '/');
  }
}
