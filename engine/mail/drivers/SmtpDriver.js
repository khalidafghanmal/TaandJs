import net from 'node:net';
import tls from 'node:tls';

/**
 * Native SMTP driver — zero extra dependencies, STARTTLS + AUTH LOGIN.
 */
export class SmtpDriver {
  constructor(config = {}) {
    this.#host = config.host ?? '127.0.0.1';
    this.#port = Number(config.port ?? 2525);
    this.#user = config.username ?? '';
    this.#pass = config.password ?? '';
    this.#secure = config.secure === true;
    this.#timeout = Number(config.timeout ?? 30_000);
  }

  #host;
  #port;
  #user;
  #pass;
  #secure;
  #timeout;

  async send(message, raw) {
    let socket = await this.#connect();

    try {
      await this.#expect(socket, 220);
      await this.#send(socket, 'EHLO Taand.local');
      await this.#expect(socket, 250);

      if (!this.#secure && this.#port === 587) {
        await this.#send(socket, 'STARTTLS');
        await this.#expect(socket, 220);
        socket = await this.#upgradeTls(socket);
        await this.#send(socket, 'EHLO Taand.local');
        await this.#expect(socket, 250);
      }

      return await this.#deliver(socket, message, raw);
    } finally {
      socket.destroy();
    }
  }

  async #deliver(socket, message, raw) {
    const recipients = [
      ...message.to,
      ...message.cc ?? [],
      ...message.bcc ?? [],
    ].map((a) => a.email);

    if (this.#user) {
      await this.#auth(socket);
    }

    await this.#send(socket, `MAIL FROM:<${message.from.email}>`);
    await this.#expect(socket, 250);

    for (const email of recipients) {
      await this.#send(socket, `RCPT TO:<${email}>`);
      await this.#expect(socket, 250);
    }

    await this.#send(socket, 'DATA');
    await this.#expect(socket, 354);
    // RFC 5321 4.5.2: CRLF-only line endings plus dot-stuffing, so body text can never end DATA early.
    const body = raw.replace(/\r\n|\r|\n/g, '\r\n').replace(/^\./gm, '..');
    await this.#send(socket, `${body}\r\n.`);
    await this.#expect(socket, 250);
    await this.#send(socket, 'QUIT');

    return { id: `smtp_${Date.now()}`, driver: 'smtp' };
  }

  async #auth(socket) {
    await this.#send(socket, 'AUTH LOGIN');
    await this.#expect(socket, 334);
    await this.#send(socket, Buffer.from(this.#user).toString('base64'));
    await this.#expect(socket, 334);
    await this.#send(socket, Buffer.from(this.#pass).toString('base64'));
    await this.#expect(socket, 235);
  }

  #connect() {
    return new Promise((resolve, reject) => {
      const onError = (err) => reject(new Error(`[Taand] SMTP connection failed: ${err.message}`));
      const timer = setTimeout(() => reject(new Error('[Taand] SMTP connection timed out')), this.#timeout);

      if (this.#secure) {
        const socket = tls.connect({ host: this.#host, port: this.#port, servername: this.#host }, () => {
          clearTimeout(timer);
          resolve(socket);
        });
        socket.on('error', onError);
        return;
      }

      const socket = net.connect({ host: this.#host, port: this.#port }, () => {
        clearTimeout(timer);
        resolve(socket);
      });
      socket.on('error', onError);
    });
  }

  #upgradeTls(socket) {
    return new Promise((resolve, reject) => {
      const upgraded = tls.connect({
        socket,
        host: this.#host,
        servername: this.#host,
      }, () => resolve(upgraded));
      upgraded.on('error', (err) => reject(new Error(`[Taand] STARTTLS failed: ${err.message}`)));
    });
  }

  #send(socket, data) {
    return new Promise((resolve, reject) => {
      socket.write(`${data}\r\n`, (err) => (err ? reject(err) : resolve()));
    });
  }

  #expect(socket, code) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('[Taand] SMTP response timed out')), this.#timeout);

      const onData = (chunk) => {
        clearTimeout(timer);
        socket.off('data', onData);
        const response = chunk.toString();
        if (!response.startsWith(String(code))) {
          reject(new Error(`[Taand] SMTP error: ${response.trim()}`));
          return;
        }
        resolve(response);
      };

      socket.on('data', onData);
    });
  }
}
