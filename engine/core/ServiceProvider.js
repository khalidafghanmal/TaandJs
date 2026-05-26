/**
 * Base service provider — Taand's Illuminate\Support\ServiceProvider.
 */
export class ServiceProvider {
  constructor(app) {
    this.app = app;
  }

  register() {}

  boot() {}
}
