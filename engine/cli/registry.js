import { COMMAND_MANIFEST, readPackageMeta } from './manifest.js';

const commandMap = new Map(COMMAND_MANIFEST.map((c) => [c.name, c]));

export function createRegistry() {
  return {
    meta: readPackageMeta(),
    get(name) {
      return commandMap.get(name) ?? null;
    },
    all() {
      return [...commandMap.values()].sort((a, b) => a.name.localeCompare(b.name));
    },
    async load(name) {
      const def = commandMap.get(name);
      if (!def?.load) return null;

      const mod = await def.load();
      const exported = Object.values(mod).find((v) => typeof v === 'function' && v.prototype?.run);
      if (!exported) return null;

      return new exported();
    },
  };
}
