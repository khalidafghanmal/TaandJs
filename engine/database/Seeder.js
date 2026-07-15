/**
 * Base database seeder — extend and implement run().
 */
export class Seeder {
  constructor(app) {
    this.app = app;
  }

  db() {
    return this.app.make('db');
  }

  hasher() {
    return this.app.make('hasher');
  }

  /** Run another seeder class. */
  async call(SeederClass) {
    await new SeederClass(this.app).run();
  }
}
