import { app } from './app.js';

/**
 * Public asset URL — files in web/
 *
 *   asset('images/logo.png')  →  /images/logo.png
 */
export function asset(path) {
  return app.make('assets').url(path);
}

/**
 * Uploaded file URL — files in storage/uploads/
 *
 *   storage('uploads/abc.jpg')  →  /storage/uploads/abc.jpg
 */
export function storage(path) {
  return app.make('assets').storageUrl(path);
}

export default asset;
