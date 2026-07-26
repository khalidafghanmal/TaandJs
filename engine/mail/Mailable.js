import { MailMessage } from './MailMessage.js';

/**
 * Base mailable class — extend and implement build().
 */
export class Mailable {
  constructor(app) {
    this.app = app;
    this.#message = MailMessage.make(app);
  }

  #message;

  build() {
    return this.#message;
  }

  async toMessage() {
    const builder = await this.build();
    if (!(builder instanceof MailMessage)) {
      throw new Error(`[Taand] ${this.constructor.name}.build() must return a MailMessage`);
    }
    return builder.build();
  }
}
