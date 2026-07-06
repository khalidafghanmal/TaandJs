import { DirectiveNormalizer } from './DirectiveNormalizer.js';
import { readParenContent } from './ParenReader.js';
import { qualifyHelperCalls, isRawHtmlHelper } from './viewHelpers.js';

/**
 * TaandView compiler — easy syntax, compiled once, cached for speed.
 */
export class TaandCompiler {
  #partialId = 0;
  #normalizer = new DirectiveNormalizer();

  compile(source) {
    this.#partialId = 0;
    this.#partials = [];
    const normalized = this.#normalizer.normalize(source);
    const layout = this.#extractLayout(normalized);
    let body = normalized.replace(/@t-layout\(['"][^'"]+['"]\)\s*/g, '');

    const slots = this.#extractSlots(body);
    const slotCode = this.#compileSlotAssignments(slots.items);

    let bodyCode = slots.stripped;
    bodyCode = this.#compileFills(bodyCode);
    bodyCode = this.#compilePartials(bodyCode);
    bodyCode = this.#compileWhenBlocks(bodyCode);
    bodyCode = this.#compileLoopBlocks(bodyCode);
    bodyCode = this.#compileOutput(bodyCode);

    const code = `${slotCode}\n${bodyCode}`;

    return {
      layout,
      code: `export default async function render(__data, __helpers) {
  const __e = __helpers.escape;
  let __out = '';
  const __slots = {};
  ${code}
  return { html: __out, slots: __slots, layout: ${layout ? JSON.stringify(layout) : 'null'} };
}`,
    };
  }

  #extractLayout(source) {
    const match = source.match(/@t-layout\(['"]([^'"]+)['"]\)/);
    return match ? match[1] : null;
  }

  #extractSlots(source) {
    const items = [];
    const stripped = source.replace(
      /@t-slot\(['"]([^'"]+)['"]\)([\s\S]*?)@t-endslot/g,
      (_, name, content) => {
        items.push({ name, content });
        return '';
      },
    );
    return { items, stripped };
  }

  #compileSlotAssignments(slots) {
    return slots
      .map(({ name, content }) => {
        const inner = this.#compileInner(content);
        return `__slots[${JSON.stringify(name)}] = await (async () => { let __out = ''; ${inner} return __out; })();`;
      })
      .join('\n');
  }

  #compileFills(source) {
    return source.replace(/@t-fill\(['"]([^'"]+)['"]\)/g, (_, name) => `@@FILL:${name}@@`);
  }

  #compilePartials(source) {
    return source.replace(
      /@t-partial\(['"]([^'"]+)['"](?:\s*,\s*(\{[^}]+\}))?\)/g,
      (_, name, dataExpr) => {
        const id = this.#partialId++;
        const data = dataExpr ? this.#compileExpr(dataExpr) : '__data';
        this.#partials[id] = { name, data };
        return `@@PARTIAL:${id}@@`;
      },
    );
  }

  #partials = [];

  #compileWhenBlocks(source) {
    const WHEN = '@t-when(';
    const ENDWHEN = '@t-endwhen';
    let result = '';
    let pos = 0;

    while (pos < source.length) {
      const whenIdx = source.indexOf(WHEN, pos);
      if (whenIdx === -1) {
        result += source.slice(pos);
        break;
      }

      result += source.slice(pos, whenIdx);

      const openParen = whenIdx + WHEN.length - 1;
      const { content: condition, closeIndex } = readParenContent(source, openParen);
      const innerStart = closeIndex + 1;
      const endWhenIdx = source.indexOf(ENDWHEN, innerStart);
      if (endWhenIdx === -1) {
        throw new Error('[TaandView] Missing @t-endwhen for @t-when block');
      }

      const code = this.#compileWhenInner(condition, source.slice(innerStart, endWhenIdx));
      result += `@@STMT:${code}@@`;
      pos = endWhenIdx + ENDWHEN.length;
    }

    return result;
  }

  #compileWhenInner(firstCondition, inner) {
    let code = '';
    let rest = inner.trim();

    const mainEnd = this.#findWhenBranchEnd(rest);
    const mainBody = rest.slice(0, mainEnd).trim();
    if (mainBody) {
      code += `if (${this.#compileExpr(firstCondition)}) { ${this.#compileInner(mainBody)} }`;
    }
    rest = rest.slice(mainEnd).trim();

    while (rest.startsWith('@t-orwhen')) {
      const openParen = rest.indexOf('(');
      const { content: condition, closeIndex } = readParenContent(rest, openParen);
      rest = rest.slice(closeIndex + 1);
      const branchEnd = this.#findWhenBranchEnd(rest);
      const body = rest.slice(0, branchEnd).trim();
      code += ` else if (${this.#compileExpr(condition)}) { ${this.#compileInner(body)} }`;
      rest = rest.slice(branchEnd).trim();
    }

    if (rest.startsWith('@t-otherwise')) {
      const body = rest.slice('@t-otherwise'.length).trim();
      if (body) code += ` else { ${this.#compileInner(body)} }`;
    }

    return code;
  }

  #findWhenBranchEnd(source) {
    const markers = ['@t-orwhen', '@t-otherwise'];
    const indices = markers
      .map((tag) => source.indexOf(tag))
      .filter((index) => index !== -1);
    return indices.length === 0 ? source.length : Math.min(...indices);
  }

  #compileLoopBlocks(source) {
    return source.replace(
      /@t-loop\(\$([a-zA-Z_]\w*)(?:\s*,\s*\$([a-zA-Z_]\w*))?\s+in\s+([^)]+)\)([\s\S]*?)@t-endloop/g,
      (_, first, second, iterable, body) => {
        const valueName = second ? second : first;
        const keyName = second ? first : null;
        const iterableCode = this.#compileExpr(iterable);
        const inner = this.#compileInner(body, '__scope');

        const scopeSetup = keyName
          ? `const __scope = { ...__data, ${keyName}: __index, ${valueName}: __item };`
          : `const __scope = { ...__data, ${valueName}: __item };`;

        const code = `for (const [__index, __item] of __helpers.iterate(${iterableCode})) {
  ${scopeSetup}
  ${inner}
}`;
        return `@@STMT:${code}@@`;
      },
    );
  }

  #compileInner(content, ctx = '__data') {
    let code = content;
    code = this.#compileWhenBlocks(code);
    code = this.#compileLoopBlocks(code);
    code = this.#compilePartials(code);
    return this.#compileOutput(code, ctx);
  }

  #compileOutput(source, ctx = '__data') {
    let code = '';
    const tokenRegex =
      /@@STMT:([\s\S]*?)@@|@@PARTIAL:(\d+)@@|@@FILL:([a-zA-Z0-9._-]+)@@|\{\{\s*([^}]+)\s*\}\}|\{\!\s*([^!]+)\s*\!\}/g;

    let lastIndex = 0;
    let match;

    while ((match = tokenRegex.exec(source)) !== null) {
      if (match.index > lastIndex) {
        code += this.#emitText(source.slice(lastIndex, match.index));
      }

      if (match[1] !== undefined) {
        code += match[1];
      } else if (match[2] !== undefined) {
        const partial = this.#partials[Number(match[2])];
        code += `__out += await __helpers.partial(${JSON.stringify(partial.name)}, ${partial.data});`;
      } else if (match[3] !== undefined) {
        code += `__out += __helpers.fill(${JSON.stringify(match[3])});`;
      } else if (match[4] !== undefined) {
        const expr = match[4].trim();
        const compiled = this.#compileExpr(expr, ctx);
        if (isRawHtmlHelper(expr)) {
          code += `__out += String(${compiled} ?? '');`;
        } else {
          code += `__out += __e(${compiled});`;
        }
      } else if (match[5] !== undefined) {
        code += `__out += String(${this.#compileExpr(match[5].trim(), ctx)} ?? '');`;
      }

      lastIndex = tokenRegex.lastIndex;
    }

    if (lastIndex < source.length) {
      code += this.#emitText(source.slice(lastIndex));
    }

    return code;
  }

  #emitText(text) {
    if (!text) return '';
    return `__out += ${JSON.stringify(text)};`;
  }

  #compileExpr(expr, ctx = '__data') {
    const trimmed = expr.trim();

    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
      const inner = trimmed.slice(1, -1).replace(/\$([a-zA-Z_]\w*)/g, `${ctx}.$1`);
      this.#assertSafe(inner);
      return `({ ${qualifyHelperCalls(inner)} })`;
    }

    const safe = trimmed.replace(/\$([a-zA-Z_]\w*(?:\.\w+)*)/g, `${ctx}.$1`);
    const qualified = qualifyHelperCalls(safe);
    this.#assertSafe(qualified);
    return qualified;
  }

  #assertSafe(expr) {
    const blocked = [
      /(?:eval|Function|import|require|process|global|globalThis|window|document|constructor|__proto__|prototype|=>)/i,
      /\bfunction\b/i,
      /\bnew\s+Function\b/i,
      /\)\s*\(/,
      /\[\s*['"]constructor['"]\s*\]/i,
      /\bsetTimeout\b|\bsetInterval\b/i,
    ];

    for (const pattern of blocked) {
      if (pattern.test(expr)) {
        throw new Error(`[TaandView] Unsafe expression blocked: ${expr}`);
      }
    }
  }
}
