const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const URL_RE = /^https?:\/\/.+/i;

export function isEmpty(value) {
  if (value === null || value === undefined) return true;
  if (typeof value === 'string' && value.trim() === '') return true;
  if (Array.isArray(value) && value.length === 0) return true;
  return false;
}

/**
 * Size used by min/max: numeric value for fields with a numeric rule, item count
 * for arrays, otherwise string length (Laravel semantics).
 */
function sizeOf(value, ruleList = []) {
  const numeric = ruleList.some((rule) => rule.name === 'numeric' || rule.name === 'integer');
  if (numeric && typeof value === 'string' && value.trim() !== '') return Number(value);
  if (typeof value === 'number') return value;
  if (typeof value === 'string' || Array.isArray(value)) return value.length;
  return NaN;
}

export function getValue(data, key) {
  if (!key.includes('.')) return data[key];

  let current = data;
  for (const part of key.split('.')) {
    if (current == null || typeof current !== 'object') return undefined;
    current = current[part];
  }
  return current;
}

export function parseRules(ruleDef) {
  if (Array.isArray(ruleDef)) {
    return ruleDef.map(parseRule);
  }

  if (typeof ruleDef === 'function') {
    return [{ name: 'callback', params: [], callback: ruleDef }];
  }

  return String(ruleDef)
    .split('|')
    .map((part) => part.trim())
    .filter(Boolean)
    .map(parseRule);
}

function parseRule(rule) {
  if (typeof rule === 'function') {
    return { name: 'callback', params: [], callback: rule };
  }

  const colon = rule.indexOf(':');
  if (colon === -1) return { name: rule, params: [] };

  const name = rule.slice(0, colon);
  const params = rule.slice(colon + 1).split(',').map((p) => p.trim());
  return { name, params };
}

export const rules = {
  required(value) {
    return !isEmpty(value) || 'required';
  },

  string(value) {
    return typeof value === 'string' || 'string';
  },

  email(value) {
    return (typeof value === 'string' && EMAIL_RE.test(value)) || 'email';
  },

  min(value, [min], _data, _field, _rule, ruleList) {
    return sizeOf(value, ruleList) >= Number(min) || 'min';
  },

  max(value, [max], _data, _field, _rule, ruleList) {
    return sizeOf(value, ruleList) <= Number(max) || 'max';
  },

  numeric(value) {
    if (typeof value === 'number' && !Number.isNaN(value)) return true;
    if (typeof value === 'string' && value.trim() !== '' && !Number.isNaN(Number(value))) return true;
    return 'numeric';
  },

  integer(value) {
    if (Number.isInteger(value)) return true;
    if (typeof value === 'string' && /^-?\d+$/.test(value.trim())) return true;
    return 'integer';
  },

  boolean(value) {
    if (typeof value === 'boolean') return true;
    if (['true', 'false', '1', '0', 1, 0].includes(value)) return true;
    return 'boolean';
  },

  in(value, params) {
    return params.includes(String(value)) || 'in';
  },

  not_in(value, params) {
    return !params.includes(String(value)) || 'not_in';
  },

  regex(value, [pattern]) {
    try {
      const re = new RegExp(pattern);
      return (typeof value === 'string' && re.test(value)) || 'regex';
    } catch {
      return 'regex';
    }
  },

  confirmed(value, _params, data, field) {
    const other = getValue(data, `${field}_confirmation`);
    return value === other || 'confirmed';
  },

  same(value, [other], data) {
    return value === getValue(data, other) || 'same';
  },

  different(value, [other], data) {
    return value !== getValue(data, other) || 'different';
  },

  array(value) {
    return Array.isArray(value) || 'array';
  },

  url(value) {
    return (typeof value === 'string' && URL_RE.test(value)) || 'url';
  },

  alpha(value) {
    return (typeof value === 'string' && /^[A-Za-z]+$/.test(value)) || 'alpha';
  },

  alpha_num(value) {
    return (typeof value === 'string' && /^[A-Za-z0-9]+$/.test(value)) || 'alpha_num';
  },

  digits(value, [length]) {
    const n = Number(length);
    return (typeof value === 'string' && new RegExp(`^\\d{${n}}$`).test(value)) || 'digits';
  },

  date(value) {
    if (typeof value !== 'string') return 'date';
    const time = Date.parse(value);
    return !Number.isNaN(time) || 'date';
  },

  callback(value, _params, data, field, rule) {
    const result = rule.callback(value, data, field);
    return result === true ? true : (result || 'callback');
  },
};
