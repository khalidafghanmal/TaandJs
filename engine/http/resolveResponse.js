import { Response, toResponse } from './Response.js';
import { View } from '../view/View.js';
import { Redirect } from './Redirect.js';
import { Paginator } from '../database/Paginator.js';
import { JsonResource, ResourceCollection, PaginatedResourceCollection } from './JsonResource.js';

/**
 * Resolves route handler output — views, redirects, API resources, and plain responses.
 */
export async function resolveResponse(value, app) {
  if (value instanceof View) {
    const html = await app.make('view').render(value.name, value.data);
    return Response.html(html);
  }

  if (value instanceof Redirect) {
    return value.toResponse();
  }

  if (value instanceof Paginator) {
    return Response.json(value.toJSON());
  }

  if (
    value instanceof JsonResource ||
    value instanceof ResourceCollection ||
    value instanceof PaginatedResourceCollection
  ) {
    return Response.json(value.toJSON());
  }

  if (value instanceof Promise) {
    return resolveResponse(await value, app);
  }

  return toResponse(value);
}
