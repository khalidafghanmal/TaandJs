import { isEmpty } from './Rules.js';
import { resolveDelegate } from '../database/resolveDelegate.js';

function coerceId(value) {
  const n = Number(value);
  return Number.isInteger(n) ? n : value;
}

/**
 * Prisma-backed validation rules — unique & exists.
 * Registered on the validator via ValidationServiceProvider.
 */
export function createDbRules(app) {
  const db = () => app.make('db');

  return {
    /**
     * unique:user,email — value must not exist in column.
     * unique:user,email,5 — ignore row with id 5 (updates).
     * unique:user,email,5,id — custom id column name.
     */
    async unique(value, params) {
      if (isEmpty(value)) return true;

      const [table, column, except, idColumn = 'id'] = params;
      if (!table || !column) {
        throw new Error('[Taand] unique rule requires model,column (e.g. unique:user,email)');
      }

      const delegate = resolveDelegate(db(), table);
      const where = { [column]: value };

      if (except !== undefined && except !== '') {
        where[idColumn] = { not: coerceId(except) };
      }

      const count = await delegate.count({ where });
      return count === 0 || 'unique';
    },

    /**
     * exists:user,id — value must exist in column.
     * exists:user,email — check email column instead.
     */
    async exists(value, params) {
      if (isEmpty(value)) return true;

      const [table, column = 'id'] = params;
      if (!table) {
        throw new Error('[Taand] exists rule requires model (e.g. exists:user,id)');
      }

      const delegate = resolveDelegate(db(), table);
      const row = await delegate.findFirst({
        where: { [column]: coerceId(value) },
        select: { [column]: true },
      });

      return row !== null || 'exists';
    },
  };
}
