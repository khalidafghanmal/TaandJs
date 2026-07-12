import { ServiceProvider } from '../core/ServiceProvider.js';
import { Validator } from '../validation/Validator.js';
import { rules } from '../validation/Rules.js';
import { createDbRules } from '../validation/DbRules.js';

export class ValidationServiceProvider extends ServiceProvider {
  register() {
    this.app.singleton('validator', (app) => {
      return new Validator(app, { ...rules, ...createDbRules(app) });
    });
  }

  boot() {}
}
