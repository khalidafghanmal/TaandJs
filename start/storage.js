/**
 * Storage facade — Taand Storage::disk() equivalent.
 */
export default function storage(app) {
  return app.make('storage');
}

export function disk(name = null) {
  throw new Error('[Taand] storage.disk() requires app context — use storage(app).disk(name)');
}
