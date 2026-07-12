/**
 * Base form request — define rules() and call validated() in controllers.
 */
export class FormRequest {
  constructor(app, request) {
    this.app = app;
    this.request = request;
  }

  rules() {
    return {};
  }

  messages() {
    return {};
  }

  attributes() {
    return {};
  }

  async validated() {
    return this.app.make('validator').validateRequest(
      this.request,
      this.rules(),
      this.messages(),
      this.attributes(),
    );
  }
}
