import { app } from './app.js';

/**
 * Settings helper — reads the engine registry, so keys use registry names, not
 * settings file names: cfg('app.name') for settings/runtime.js, cfg('auth.session.lifetime')
 * for settings/security.js, … (see normalizeSettings in engine/core/SettingsLoader.js).
 */
export default function cfg(key, fallback = null) {
  return app.make('config').get(key, fallback);
}
