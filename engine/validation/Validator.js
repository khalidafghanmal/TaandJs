import { ValidationError } from './ValidationError.js';
import { getValue, isEmpty, parseRules } from './Rules.js';

/**
 * Input validator — Taand's Illuminate\Validation\Validator equivalent.
 */
export class Validator {
  constructor(app, ruleHandlers = null) {
    this.app = app;
    this.#rules = ruleHandlers ?? {};
  }

  #rules;

  async make(data, ruleSet, messages = {}, attributes = {}) {
    const config = this.app.make('config').get('validation', {});
    const mergedMessages = { ...config.messages, ...messages };
    const mergedAttributes = { ...config.attributes, ...attributes };

    const errors = {};
    const validated = {};

    for (const [field, ruleDef] of Object.entries(ruleSet)) {
      const value = getValue(data, field);
      const ruleList = parseRules(ruleDef);
      const nullable = ruleList.some((rule) => rule.name === 'nullable');

      if (nullable && isEmpty(value)) {
        validated[field] = value ?? null;
        continue;
      }

      let failed = false;

      for (const rule of ruleList) {
        if (rule.name === 'nullable') continue;

        const handler = this.#rules[rule.name];
        if (!handler) {
          throw new Error(`[Taand] Unknown validation rule: ${rule.name}`);
        }

        const result = await Promise.resolve(handler(value, rule.params, data, field, rule, ruleList));
        if (result === true) continue;

        const ruleKey = typeof result === 'string' ? result : rule.name;
        const message = this.#message(field, ruleKey, rule.params, mergedMessages, mergedAttributes);
        errors[field] = [message];
        failed = true;
        break;
      }

      if (!failed) {
        validated[field] = value;
      }
    }

    if (Object.keys(errors).length > 0) {
      throw new ValidationError(errors);
    }

    return validated;
  }

  async validateRequest(request, ruleSet, messages = {}, attributes = {}) {
    return this.make(request.all(), ruleSet, messages, attributes);
  }

  #message(field, rule, params, messages, attributes) {
    const attribute = attributes[field] ?? this.#humanize(field);
    const custom = messages[`${field}.${rule}`] ?? messages[rule];

    if (custom) {
      return this.#replace(custom, attribute, params);
    }

    return this.#replace(this.#defaultMessage(rule), attribute, params);
  }

  #defaultMessage(rule) {
    const defaults = {
      required: 'The :attribute field is required.',
      string: 'The :attribute must be a string.',
      email: 'The :attribute must be a valid email address.',
      min: 'The :attribute must be at least :min characters.',
      max: 'The :attribute may not be greater than :max characters.',
      numeric: 'The :attribute must be a number.',
      integer: 'The :attribute must be an integer.',
      boolean: 'The :attribute must be true or false.',
      in: 'The selected :attribute is invalid.',
      not_in: 'The selected :attribute is invalid.',
      regex: 'The :attribute format is invalid.',
      confirmed: 'The :attribute confirmation does not match.',
      same: 'The :attribute must match :other.',
      different: 'The :attribute and :other must be different.',
      array: 'The :attribute must be an array.',
      url: 'The :attribute must be a valid URL.',
      alpha: 'The :attribute may only contain letters.',
      alpha_num: 'The :attribute may only contain letters and numbers.',
      digits: 'The :attribute must be :digits digits.',
      date: 'The :attribute is not a valid date.',
      unique: 'The :attribute has already been taken.',
      exists: 'The selected :attribute is invalid.',
      callback: 'The :attribute is invalid.',
    };

    return defaults[rule] ?? 'The :attribute is invalid.';
  }

  #replace(template, attribute, params) {
    return template
      .replace(/:attribute/g, attribute)
      .replace(/:min/g, params[0] ?? '')
      .replace(/:max/g, params[0] ?? '')
      .replace(/:digits/g, params[0] ?? '')
      .replace(/:other/g, params[0] ?? '')
      .replace(/:values/g, params.join(', '));
  }

  #humanize(field) {
    return field
      .split('.')
      .pop()
      .replace(/[_-]/g, ' ')
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .toLowerCase();
  }
}
