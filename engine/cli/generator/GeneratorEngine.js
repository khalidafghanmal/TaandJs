import path from 'node:path';
import { GeneratorContext } from './GeneratorContext.js';
import { TemplateEngine } from './TemplateEngine.js';
import { writeGeneratedFile } from './writeGenerated.js';
import { GENERATOR_DEFINITIONS } from './definitions.js';

/**
 * Isolated code generator — no app bootstrap, DB, routes, or builds.
 */
export class GeneratorEngine {
  static run(generatorId, { positionals, flags, root = null, fromUrl = import.meta.url }) {
    const def = GENERATOR_DEFINITIONS[generatorId];
    if (!def) {
      throw new Error(`[Taand] Unknown generator [${generatorId}]`);
    }

    const raw = positionals[0];
    if (!raw) {
      process.stdout.write(`[Taand] ${def.missing}\n`);
      process.exitCode = 1;
      return { ok: false };
    }

    const ctx = root ? new GeneratorContext(root) : GeneratorContext.resolve(fromUrl);
    const force = flags?.has?.('force') || flags?.has?.('f');
    const spec = def.resolve(ctx, raw);
    for (const file of [spec.outFile, ...(spec.extraFiles ?? []).map((e) => e.path)]) {
      const rel = path.relative(ctx.root, file);
      if (!rel || rel === '..' || rel.startsWith(`..${path.sep}`) || path.isAbsolute(rel)) {
        throw new Error(`[Taand] Refusing to write outside the project: ${file}`);
      }
    }

    const contents = TemplateEngine.render(def.stub, spec.vars);
    writeGeneratedFile(spec.outFile, contents, { force });
    process.stdout.write(`[Taand] Created: ${path.relative(ctx.root, spec.outFile)}\n`);

    if (spec.extraFiles?.length) {
      for (const extra of spec.extraFiles) {
        const extraContents = TemplateEngine.render(extra.stub, extra.vars);
        writeGeneratedFile(extra.path, extraContents, { force });
        process.stdout.write(`[Taand] Created: ${path.relative(ctx.root, extra.path)}\n`);
      }
    }

    return { ok: true, outFile: spec.outFile, label: spec.label };
  }
}
