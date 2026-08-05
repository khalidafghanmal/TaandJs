import { env } from '../engine/core/Env.js';

/** View / template engine options. */
export default {
  cache: env('TAAND_VIEW_CACHE', 'true') !== 'false',
};
