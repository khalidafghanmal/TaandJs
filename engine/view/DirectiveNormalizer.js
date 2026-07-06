import { readParenContent } from './ParenReader.js';

const BLOCK_OPEN = /@(section|if|each)\b/g;
const VIEW_NAME = /[a-zA-Z][a-zA-Z0-9._-]*/;

/**
 * Easy Taand Markup → internal directives.
 * One @end closes everything. No quotes on view names.
 */
export class DirectiveNormalizer {
  normalize(source) {
    let out = source;

    out = this.#normalizeLayout(out);
    out = this.#normalizeShow(out);
    out = this.#normalizeInclude(out);
    out = this.#normalizeSections(out);
    out = this.#normalizeEachBlocks(out);
    out = this.#normalizeIfBlocks(out);

    return out;
  }

  #normalizeLayout(source) {
    return source.replace(new RegExp(`@layout\\s+(${VIEW_NAME.source})`, 'g'), "@t-layout('$1')");
  }

  #normalizeShow(source) {
    return source.replace(new RegExp(`@show\\s+(${VIEW_NAME.source})`, 'g'), "@t-fill('$1')");
  }

  #normalizeInclude(source) {
    return source.replace(
      new RegExp(`@include\\s+(${VIEW_NAME.source})(?:\\s*,\\s*(\\{[^}]+\\}))?`, 'g'),
      (_, name, data) => (data ? `@t-partial('${name}', ${data})` : `@t-partial('${name}')`),
    );
  }

  #normalizeSections(source) {
    return this.#replaceBlocks(
      source,
      new RegExp(`@section\\s+(${VIEW_NAME.source})\\s*`, 'g'),
      (name, body) => `@t-slot('${name}')${body}@t-endslot`,
    );
  }

  #normalizeEachBlocks(source) {
    return this.#replaceBlocks(
      source,
      /@each\s+(\$?[a-zA-Z_]\w*)(?:\s*,\s*(\$?[a-zA-Z_]\w*))?\s+in\s+([^\n]+)\s*/g,
      (first, second, iterable, body) => {
        const v1 = first.startsWith('$') ? first : `$${first}`;
        const iter = iterable.trim().startsWith('$') ? iterable.trim() : `$${iterable.trim()}`;

        if (second) {
          const v2 = second.startsWith('$') ? second : `$${second}`;
          return `@t-loop(${v1}, ${v2} in ${iter})${body}@t-endloop`;
        }

        return `@t-loop(${v1} in ${iter})${body}@t-endloop`;
      },
    );
  }

  #normalizeIfBlocks(source) {
    let result = '';
    let last = 0;
    const openRegex = /@if\b\s*/g;
    openRegex.lastIndex = 0;

    let match;
    while ((match = openRegex.exec(source)) !== null) {
      const start = match.index;
      const condStart = match.index + match[0].length;
      const { condition, pos: bodyStart } = this.#parseCondition(source, condStart);
      const end = this.#findMatchingEnd(source, bodyStart);

      if (end === -1) {
        throw new Error('[TaandView] Missing @end for block — add @end to close @section, @if, or @each');
      }

      const body = source.slice(bodyStart, end);
      const parts = this.#splitIfBody(body);
      let code = `@t-when(${condition})${parts.main}`;

      for (const clause of parts.elseif) {
        code += `@t-orwhen(${clause.cond})${clause.body}`;
      }

      if (parts.else !== null) {
        code += `@t-otherwise${parts.else}`;
      }

      result += source.slice(last, start);
      result += `${code}@t-endwhen`;
      last = end + 4;
      openRegex.lastIndex = last;
    }

    return result + source.slice(last);
  }

  #parseCondition(source, start) {
    let i = start;
    while (i < source.length && /\s/.test(source[i])) i += 1;

    if (source[i] === '(') {
      const { content, closeIndex } = readParenContent(source, i);
      return { condition: content.trim(), pos: closeIndex + 1 };
    }

    let end = i;
    while (end < source.length && source[end] !== '\n' && source[end] !== '\r') end += 1;
    return { condition: source.slice(i, end).trim(), pos: end };
  }

  #splitIfBody(body) {
    const parts = body.split(/(?=@elseif\s|@else\b)/);
    const main = parts[0] ?? '';
    const elseif = [];
    let elseBody = null;

    for (let i = 1; i < parts.length; i++) {
      const part = parts[i];
      if (part.startsWith('@elseif')) {
        const condStart = part.indexOf('@elseif') + '@elseif'.length;
        const { condition, pos } = this.#parseCondition(part, condStart);
        elseif.push({ cond: condition, body: part.slice(pos) });
      } else if (part.startsWith('@else')) {
        elseBody = part.replace(/^@else\s*/, '');
      }
    }

    return { main, elseif, else: elseBody };
  }

  #replaceBlocks(source, openRegex, transform) {
    let result = '';
    let last = 0;
    openRegex.lastIndex = 0;

    let match;
    while ((match = openRegex.exec(source)) !== null) {
      const start = match.index;
      const bodyStart = match.index + match[0].length;
      const end = this.#findMatchingEnd(source, bodyStart);

      if (end === -1) {
        throw new Error('[TaandView] Missing @end for block — add @end to close @section, @if, or @each');
      }

      result += source.slice(last, start);
      result += transform(...match.slice(1), source.slice(bodyStart, end));
      last = end + 4;
      openRegex.lastIndex = last;
    }

    return result + source.slice(last);
  }

  #findMatchingEnd(source, from) {
    let depth = 1;
    let i = from;

    while (i < source.length) {
      const nextEnd = source.indexOf('@end', i);
      if (nextEnd === -1) return -1;

      const slice = source.slice(i, nextEnd);
      const opens = (slice.match(BLOCK_OPEN) ?? []).length;

      depth += opens;
      depth -= 1;

      if (depth === 0) return nextEnd;
      i = nextEnd + 4;
    }

    return -1;
  }
}
