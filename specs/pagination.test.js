import test from 'node:test';
import assert from 'node:assert/strict';

import { Paginator } from '../engine/database/Paginator.js';
import { paginate } from '../engine/database/paginate.js';
import { JsonResource, ResourceCollection, PaginatedResourceCollection } from '../engine/http/JsonResource.js';

test('Paginator computes meta and links', () => {
  const page = new Paginator({
    items: [{ id: 1 }, { id: 2 }],
    total: 42,
    page: 2,
    perPage: 15,
    path: '/users',
  });

  const json = page.toJSON();

  assert.equal(json.meta.current_page, 2);
  assert.equal(json.meta.last_page, 3);
  assert.equal(json.meta.from, 16);
  assert.equal(json.meta.to, 30);
  assert.equal(json.links.prev, '/users?page=1');
  assert.equal(json.links.next, '/users?page=3');
});

test('paginate queries Prisma delegate', async () => {
  const calls = [];

  const delegate = {
    count: async (args) => {
      calls.push(['count', args]);
      return 2;
    },
    findMany: async (args) => {
      calls.push(['findMany', args]);
      return [{ id: 1 }, { id: 2 }];
    },
  };

  const page = await paginate(delegate, { page: 1, perPage: 10, where: { role: 'user' } });

  assert.equal(page.total, 2);
  assert.equal(page.items.length, 2);
  assert.equal(calls[0][0], 'count');
  assert.equal(calls[1][1].take, 10);
  assert.equal(calls[1][1].skip, 0);
});

test('JsonResource shapes single and collection output', () => {
  class UserResource extends JsonResource {
    toArray() {
      return { id: this.resource.id, name: this.resource.name };
    }
  }

  const single = UserResource.make({ id: 1, name: 'A', password: 'secret' }).toJSON();
  assert.deepEqual(single, { data: { id: 1, name: 'A' } });

  const list = UserResource.collection([{ id: 1, name: 'A' }]).toJSON();
  assert.deepEqual(list, { data: [{ id: 1, name: 'A' }] });
});

test('PaginatedResourceCollection transforms paginator data', () => {
  class UserResource extends JsonResource {
    toArray() {
      return { id: this.resource.id };
    }
  }

  const paginator = new Paginator({
    items: [{ id: 1, password: 'x' }],
    total: 1,
    page: 1,
    perPage: 15,
  });

  const json = UserResource.paginate(paginator).toJSON();
  assert.deepEqual(json.data, [{ id: 1 }]);
  assert.equal(json.meta.total, 1);
});
