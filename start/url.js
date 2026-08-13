import { app } from './app.js';
import { appUrlFromConfig } from '../engine/support/AppUrl.js';

/**
 * Absolute application URL from TAAND_APP_URL + relative path.
 */
export default function url(path = '/') {
  return appUrlFromConfig(app.make('config'), path);
}
