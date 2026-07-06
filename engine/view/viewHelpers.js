/**
 * Helpers exposed inside .taand templates ({{ }} and @t-when).
 */
export const VIEW_HELPER_NAMES = [
  'asset',
  'storage',
  'csrf_token',
  'csrf_field',
  'cfg',
  'path',
  'prev',
  'peek',
  'text',
  'none',
  'some',
  'tick',
  'e',
  'errors',
  'classNames',
  'selected',
  'checked',
];

/** Bump when view helper compilation changes — invalidates disk cache. */
export const VIEW_COMPILER_VERSION = '5';

const VIEW_HELPER_CALL = new RegExp(
  `^(${VIEW_HELPER_NAMES.join('|')})\\s*\\(`,
);

export function isViewHelperCall(expr) {
  return VIEW_HELPER_CALL.test(expr.trim());
}

/** Helpers that return safe HTML and must not be escaped in {{ }}. */
export function isRawHtmlHelper(expr) {
  return /^\s*csrf_field\s*\(\s*\)\s*$/.test(expr.trim());
}

/** Rewrite helper calls to __helpers.fn(...) so disk cache stays valid. */
export function qualifyHelperCalls(expr) {
  let out = expr;
  for (const name of VIEW_HELPER_NAMES) {
    out = out.replace(new RegExp(`\\b${name}\\s*\\(`, 'g'), `__helpers.${name}(`);
  }
  return out;
}
