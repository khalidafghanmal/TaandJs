import { resolveProjectRoot } from '../../server/resolveRoot.js';

/**
 * Lightweight generator context — no app bootstrap, DB, or routes.
 */
export class GeneratorContext {
  constructor(root) {
    this.root = root;
  }

  static resolve(fromUrl = import.meta.url) {
    return new GeneratorContext(resolveProjectRoot(fromUrl));
  }
}
