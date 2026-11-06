import { URL } from 'node:url';
import { HttpError } from './HttpError.js';

const MAX_BODY_BYTES = 1_048_576;

/**
 * HTTP request — method, path, query, params, body, JSON input.
 */
export class Request {
  #raw;
  #url;
  #body = '';
  #bodyBuffer = null;
  #params = {};
  #json = null;
  #form = null;
  #attributes = {};
  #sanitized = false;

  constructor(raw, { params = {} } = {}) {
    this.#raw = raw;
    this.#params = Object.freeze({ ...params });

    const host = raw.headers.host ?? 'localhost';
    this.#url = new URL(raw.url ?? '/', `http://${host}`);
  }

  static async from(raw) {
    const method = (raw.method ?? 'GET').toUpperCase();
    const buffer = await Request.#readBodyBuffer(raw, method);
    const request = new Request(raw);
    request.#bodyBuffer = buffer;
    request.#body = Request.#bufferToText(buffer, raw.headers['content-type']);
    return request;
  }

  static #readBodyBuffer(raw, method) {
    if (method === 'GET' || method === 'HEAD') {
      return Promise.resolve(Buffer.alloc(0));
    }

    return new Promise((resolve, reject) => {
      const chunks = [];
      let size = 0;

      raw.on('data', (chunk) => {
        size += chunk.length;
        if (size > MAX_BODY_BYTES) {
          raw.destroy();
          reject(HttpError.payloadTooLarge());
          return;
        }
        chunks.push(chunk);
      });

      raw.on('end', () => resolve(Buffer.concat(chunks)));
      raw.on('error', reject);
    });
  }

  static #bufferToText(buffer, contentType = '') {
    if (!buffer?.length) return '';
    const type = (contentType ?? '').toLowerCase();
    if (type.includes('multipart/form-data')) return '';
    return buffer.toString('utf8');
  }

  get method() {
    return (this.#raw.method ?? 'GET').toUpperCase();
  }

  get path() {
    return this.#url.pathname;
  }

  get query() {
    return Object.fromEntries(this.#url.searchParams);
  }

  get headers() {
    return this.#raw.headers;
  }

  get params() {
    return this.#params;
  }

  get body() {
    return this.#body ?? '';
  }

  get rawBody() {
    return this.#bodyBuffer ?? Buffer.alloc(0);
  }

  header(name) {
    return this.#raw.headers[name.toLowerCase()];
  }

  isMethod(...methods) {
    const upper = methods.map((m) => m.toUpperCase());
    return upper.includes(this.method);
  }

  json() {
    if (this.#json !== null) return this.#json;

    const type = this.header('content-type') ?? '';
    if (!type.includes('application/json') || !this.#body) {
      this.#json = {};
      return this.#json;
    }

    try {
      const parsed = JSON.parse(this.#body);
      this.#json = typeof parsed === 'object' && parsed !== null ? parsed : {};
    } catch {
      this.#json = {};
    }

    return this.#json;
  }

  form() {
    if (this.#form !== null) return this.#form;

    const type = this.header('content-type') ?? '';
    if (!type.includes('application/x-www-form-urlencoded') || !this.#body) {
      this.#form = {};
      return this.#form;
    }

    this.#form = Object.fromEntries(new URLSearchParams(this.#body));
    return this.#form;
  }

  cookies() {
    const header = this.header('cookie');
    if (!header) return {};

    const jar = {};
    for (const part of header.split(';')) {
      const [key, ...rest] = part.trim().split('=');
      if (key) jar[key] = rest.join('=');
    }
    return jar;
  }

  ip() {
    return this.attribute('_ip')
      ?? this.#raw.socket?.remoteAddress
      ?? '127.0.0.1';
  }

  /** HTTPS — direct TLS, or X-Forwarded-Proto from a trusted proxy (set by TrustProxies). */
  secure() {
    return Boolean(this.attribute('_secure') || this.#raw.socket?.encrypted);
  }

  /** Direct TCP peer — never spoofable via X-Forwarded-For. */
  remoteAddress() {
    return this.#raw.socket?.remoteAddress ?? '127.0.0.1';
  }

  setAttribute(key, value) {
    this.#attributes[key] = value;
    return this;
  }

  attribute(key, fallback = null) {
    return key in this.#attributes ? this.#attributes[key] : fallback;
  }

  sanitize() {
    if (this.#sanitized) return this;
    this.#sanitized = true;

    this.#json = Request.#trimValues(this.json());
    this.#form = Request.#trimValues(this.form());
    return this;
  }

  static #trimValues(data) {
    if (Array.isArray(data)) {
      return data.map((item) => Request.#trimValues(item));
    }

    if (data && typeof data === 'object') {
      const next = {};
      for (const [key, value] of Object.entries(data)) {
        next[key] = Request.#trimValues(value);
      }
      return next;
    }

    return typeof data === 'string' ? data.trim() : data;
  }

  input(key, fallback = null) {
    const form = this.form();
    if (key in form) return form[key];

    const data = this.json();
    if (key in data) return data[key];
    if (key in this.query) return this.query[key];
    if (key in this.params) return this.params[key];
    return fallback;
  }

  all() {
    return { ...this.form(), ...this.json(), ...this.query, ...this.params };
  }

  withParams(params) {
    const next = new Request(this.#raw, { params });
    next.#body = this.#body;
    next.#bodyBuffer = this.#bodyBuffer;
    next.#json = this.#json;
    next.#form = this.#form;
    next.#attributes = { ...this.#attributes };
    next.#sanitized = this.#sanitized;
    return next;
  }

  /** Copy request attributes set during routed dispatch back to the parent request. */
  mergeFrom(other) {
    if (!(other instanceof Request)) return this;
    for (const [key, value] of Object.entries(other.#attributes)) {
      this.#attributes[key] = value;
    }
    return this;
  }
}
