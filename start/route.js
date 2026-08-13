import { app } from './app.js';

/**
 * Route facade — use this in flow/http.js
 *
 *   route.get('/', (req) => 'Hello Taand');
 */
export const route = app.getRouteRegistrar();
export default route;
