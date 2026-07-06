/**
 * Read balanced (...) content starting at the opening parenthesis index.
 */
export function readParenContent(source, openParenIndex) {
  if (source[openParenIndex] !== '(') {
    throw new Error('[TaandView] Expected "("');
  }

  let depth = 0;
  for (let i = openParenIndex; i < source.length; i++) {
    const ch = source[i];
    if (ch === '(') depth += 1;
    else if (ch === ')') {
      depth -= 1;
      if (depth === 0) {
        return {
          content: source.slice(openParenIndex + 1, i),
          closeIndex: i,
        };
      }
    }
  }

  throw new Error('[TaandView] Unclosed parenthesis in directive');
}
