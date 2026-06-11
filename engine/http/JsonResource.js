/**
 * Shape a single model for JSON APIs — Taand JsonResource equivalent.
 *
 *   class UserResource extends JsonResource {
 *     toArray() { return { id: this.resource.id, name: this.resource.name }; }
 *   }
 */
export class JsonResource {
  static wrap = true;

  constructor(resource) {
    this.resource = resource;
  }

  toArray() {
    return this.resource ?? null;
  }

  toJSON() {
    const payload = this.toArray();
    return this.constructor.wrap ? { data: payload } : payload;
  }

  static make(resource) {
    return new this(resource);
  }

  static collection(resources) {
    return new ResourceCollection(resources, this);
  }

  static paginate(paginator) {
    return new PaginatedResourceCollection(paginator, this);
  }
}

/** Transform an array of models through a resource class. */
export class ResourceCollection {
  constructor(resources, resourceClass) {
    this.resources = resources;
    this.resourceClass = resourceClass;
  }

  toJSON() {
    const data = this.resources.map((item) => new this.resourceClass(item).toArray());
    return this.resourceClass.wrap ? { data } : data;
  }
}

/** Paginator + resource — keeps meta/links, transforms data rows. */
export class PaginatedResourceCollection {
  constructor(paginator, resourceClass) {
    this.paginator = paginator;
    this.resourceClass = resourceClass;
  }

  toJSON() {
    const json = this.paginator.toJSON();
    json.data = this.paginator.items.map((item) => new this.resourceClass(item).toArray());
    return json;
  }
}

export { Paginator } from '../database/Paginator.js';
