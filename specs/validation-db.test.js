import test from 'node:test';
import assert from 'node:assert/strict';

import { Validator } from '../engine/validation/Validator.js';
import { rules } from '../engine/validation/Rules.js';
import { createDbRules } from '../engine/validation/DbRules.js';
import { ValidationError } from '../engine/validation/ValidationError.js';

function mockApp(db) {
  return {
    make(name) {
      if (name === 'db') return db;
      if (name === 'config') {
        return { get: () => ({ messages: {}, attributes: {} }) };
      }
      throw new Error(`Unknown binding: ${name}`);
    },
  };
}

test('unique rule rejects duplicate via Prisma', async () => {
  const db = {
    user: {
      findFirst: async () => null,
      count: async () => 1,
    },
  };

  const validator = new Validator(mockApp(db), { ...rules, ...createDbRules(mockApp(db)) });

  await assert.rejects(
    () => validator.make({ email: 'taken@example.com' }, { email: 'required|email|unique:user,email' }),
    ValidationError,
  );
});

test('unique rule passes when no duplicate', async () => {
  const db = {
    user: {
      findFirst: async () => null,
      count: async () => 0,
    },
  };

  const app = mockApp(db);
  const validator = new Validator(app, { ...rules, ...createDbRules(app) });

  const data = await validator.make(
    { email: 'new@example.com' },
    { email: 'required|email|unique:user,email' },
  );

  assert.equal(data.email, 'new@example.com');
});

test('exists rule requires row in database', async () => {
  const db = {
    user: {
      findFirst: async () => null,
      count: async () => 0,
    },
  };

  const app = mockApp(db);
  const validator = new Validator(app, { ...rules, ...createDbRules(app) });

  await assert.rejects(
    () => validator.make({ user_id: 99 }, { user_id: 'required|integer|exists:user,id' }),
    ValidationError,
  );
});

test('exists rule passes when row found', async () => {
  const db = {
    user: {
      findFirst: async () => ({ id: 1 }),
      count: async () => 0,
    },
  };

  const app = mockApp(db);
  const validator = new Validator(app, { ...rules, ...createDbRules(app) });

  const data = await validator.make({ user_id: 1 }, { user_id: 'exists:user,id' });
  assert.equal(data.user_id, 1);
});

test('exists and unique reject Prisma operator objects from user input', async () => {
  const queries = [];
  const db = {
    user: {
      // Prisma treats { not: 0 } as a filter that matches any row, and { in: [] } as one matching none.
      findFirst: async ({ where }) => { queries.push(where); return { id: 1 }; },
      count: async ({ where }) => { queries.push(where); return 0; },
    },
  };

  const app = mockApp(db);
  const validator = new Validator(app, { ...rules, ...createDbRules(app) });

  await assert.rejects(
    () => validator.make({ user_id: { not: 0 } }, { user_id: 'required|exists:user,id' }),
    ValidationError,
  );
  await assert.rejects(
    () => validator.make({ user_id: [1] }, { user_id: 'required|exists:user,id' }),
    ValidationError,
  );
  await assert.rejects(
    () => validator.make({ email: { in: [] } }, { email: 'required|unique:user,email' }),
    ValidationError,
  );
  assert.deepEqual(queries, []);
});
