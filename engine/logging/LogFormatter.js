const ANSI = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  gray: '\x1b[90m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  amber: '\x1b[38;5;214m',
};

const LEVEL_STYLES = {
  emergency: { label: 'EMERG', color: ANSI.red },
  alert: { label: 'ALERT', color: ANSI.red },
  critical: { label: 'CRIT ', color: ANSI.red },
  error: { label: 'ERROR', color: ANSI.red },
  warning: { label: 'WARN ', color: ANSI.yellow },
  notice: { label: 'NOTE ', color: ANSI.cyan },
  info: { label: 'INFO ', color: ANSI.cyan },
  debug: { label: 'DEBUG', color: ANSI.gray },
};

const METHOD_COLORS = {
  GET: ANSI.green,
  POST: ANSI.amber,
  PUT: ANSI.cyan,
  PATCH: ANSI.cyan,
  DELETE: ANSI.red,
  HEAD: ANSI.gray,
  OPTIONS: ANSI.gray,
};

/**
 * Formats log records for console (human) or file (JSON lines).
 */
export class LogFormatter {
  format(record, { json = false, pretty = false, colors = false } = {}) {
    if (json) {
      return `${JSON.stringify(record)}\n`;
    }

    if (pretty) {
      return this.#formatPretty(record, colors);
    }

    const ctx = record.context && Object.keys(record.context).length > 0
      ? ` ${JSON.stringify(record.context)}`
      : '';

    const err = record.error ? `\n${record.error.stack ?? record.error.message}` : '';
    return `[${record.datetime}] ${record.channel}.${record.level.toUpperCase()}: ${record.message}${ctx}${err}\n`;
  }

  #formatPretty(record, colors) {
    if (record.message === 'Request completed' && record.context?.method && record.context?.path) {
      return `${this.#formatAccessLog(record.context, colors)}\n`;
    }

    const time = this.#formatTime(record.datetime);
    const level = LEVEL_STYLES[record.level] ?? LEVEL_STYLES.info;
    const levelLabel = this.#paint(level.label, level.color, colors);
    const message = this.#paint(record.message, ANSI.white, colors);
    const ctx = this.#formatContext(record.context, colors);

    let line = `  ${this.#paint(time, ANSI.gray, colors)}  ${levelLabel}  ${message}`;
    if (ctx) line += `  ${this.#paint('·', ANSI.gray, colors)}  ${ctx}`;

    if (record.error) {
      const errText = record.error.stack ?? record.error.message;
      line += `\n${this.#paint(errText, ANSI.red, colors)}`;
    }

    return `${line}\n`;
  }

  #formatAccessLog(ctx, colors) {
    const { method, path, status, ms } = ctx;
    const methodColor = METHOD_COLORS[method] ?? ANSI.white;
    const statusColor = status >= 500
      ? ANSI.red
      : status >= 400
        ? ANSI.yellow
        : status >= 300
          ? ANSI.cyan
          : ANSI.green;

    const methodText = this.#paint(method.padEnd(7), methodColor, colors);
    const pathText = this.#paint(path, ANSI.white, colors);
    const arrow = this.#paint('→', ANSI.gray, colors);
    const statusText = this.#paint(String(status), statusColor, colors);
    const duration = this.#paint(`${ms}ms`, ANSI.gray, colors);

    return `  ${methodText} ${pathText}  ${arrow}  ${statusText}  ${duration}`;
  }

  #formatContext(context, colors) {
    if (!context || Object.keys(context).length === 0) return '';

    return Object.entries(context)
      .map(([key, value]) => {
        const rendered = typeof value === 'string' ? value : JSON.stringify(value);
        return `${this.#paint(key, ANSI.gray, colors)}=${this.#paint(rendered, ANSI.white, colors)}`;
      })
      .join('  ');
  }

  #formatTime(iso) {
    const date = new Date(iso);
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    const millis = String(date.getMilliseconds()).padStart(3, '0');
    return `${hours}:${minutes}:${seconds}.${millis}`;
  }

  #paint(text, ansi, colors) {
    if (!colors || !ansi) return text;
    return `${ansi}${text}${ANSI.reset}`;
  }
}
