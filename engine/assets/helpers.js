export function createAssetHelper(app) {
  return (path) => app.make('assets').url(path);
}

export function createStorageHelper(app) {
  return (path) => app.make('assets').storageUrl(path);
}

/**
 * For use in routes: return asset('css/app.css') — not a view, just URL string helper.
 */
export function asset(app, path) {
  return app.make('assets').url(path);
}

export function storage(app, path) {
  return app.make('assets').storageUrl(path);
}
