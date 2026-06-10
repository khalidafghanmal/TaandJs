const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'X-XSS-Protection': '0',
};

/**
 * HTTP response builder — converts handler output into a safe Node response.
 */
export class Response {
  constructor(body = '', status = 200, headers = {}) {
    this.body = body;
    this.status = status;
    this.headers = { ...SECURITY_HEADERS, ...headers };
  }

  static html(content, status = 200) {
    return new Response(content, status, { 'Content-Type': 'text/html; charset=utf-8' });
  }

  static text(content, status = 200) {
    return new Response(content, status, { 'Content-Type': 'text/plain; charset=utf-8' });
  }

  static json(data, status = 200) {
    return new Response(JSON.stringify(data), status, {
      'Content-Type': 'application/json; charset=utf-8',
    });
  }

  static notFound(message = '404 Not Found') {
    return Response.text(message, 404);
  }

  static methodNotAllowed(allowed = []) {
    const headers = allowed.length ? { Allow: allowed.join(', ') } : {};
    return new Response('405 Method Not Allowed', 405, headers);
  }

  static error(message = '500 Internal Server Error', status = 500) {
    return Response.text(message, status);
  }

  static appendCookie(response, cookie) {
    const key = 'Set-Cookie';
    const existing = response.headers[key];

    if (!existing) {
      response.headers[key] = [cookie];
    } else if (Array.isArray(existing)) {
      existing.push(cookie);
    } else {
      response.headers[key] = [existing, cookie];
    }
  }

  send(res) {
    res.writeHead(this.status, this.headers);
    res.end(this.body);
  }
}

/**
 * Normalize any handler return value into a Response.
 */
export function toResponse(value) {
  if (value instanceof Response) return value;
  if (value === null || value === undefined) return Response.text('');
  if (typeof value === 'string') return Response.html(value);
  if (typeof value === 'object') return Response.json(value);
  return Response.text(String(value));
}
