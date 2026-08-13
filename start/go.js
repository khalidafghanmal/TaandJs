import { Redirect } from '../engine/http/Redirect.js';
import { app } from './app.js';
import back from './back.js';
import { currentRequest } from '../engine/support/RequestContext.js';
import { appUrlFromConfig } from '../engine/support/AppUrl.js';

/**
 * Redirect helper — go('/dashboard') or go.path('home')
 */
export default function go(target, status = 302) {
  return Redirect.to(target, status);
}

go.path = function goPath(name, params = {}, status = 302) {
  const routeUrl = app.make('route').url(name, params);
  return Redirect.to(routeUrl, status);
};

go.back = function goBack(fallback = '/') {
  return back(currentRequest(), fallback);
};

go.url = function goUrl(path = '/') {
  return appUrlFromConfig(app.make('config'), path);
};
