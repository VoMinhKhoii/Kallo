import { inspect } from 'node:util';
import { DrizzleQueryError } from 'drizzle-orm/errors';
import { describe, expect, it } from 'vitest';
import { safeError, stripQueryParams } from '@/lib/core/errors/safe-error';

describe('safeError', () => {
  it('drops raw postgres details while retaining its query and SQLSTATE', () => {
    const error = Object.assign(new Error('invalid input private value'), {
      name: 'PostgresError',
      code: '22P02',
      query: 'select $1',
      parameters: ['private value'],
    });
    expect((safeError(error) as Error).message).toBe(
      'Failed query: select $1 [22P02]'
    );
    expect(inspect(safeError(error))).not.toContain('private value');
  });
  it('retains SQL and driver code without params, quoted causes or fake frames', () => {
    const secret = 'private meal\n    at secretParam (/private/meal.ts:1:1)';
    const cause = Object.assign(new Error(`bad input ${secret}`), {
      code: '22P02',
      detail: secret,
    });
    const error = new DrizzleQueryError(
      'insert into meals values ($1)',
      [secret],
      cause
    );
    const safe = safeError(error) as Error;
    expect(safe.message).toBe(
      'Failed query: insert into meals values ($1) [22P02]'
    );
    expect(safe.stack).toContain('safe-error.test.ts');
    expect(inspect(safe)).not.toContain('secretParam');
    expect(inspect(safe)).not.toContain('private meal');
    expect(safe).not.toHaveProperty('params');
    expect(safe).not.toHaveProperty('cause');
    expect(error.params).toEqual([secret]);
  });

  it('finds DB errors through wrapped causes and handles cycles', () => {
    const db = new DrizzleQueryError(
      'select $1',
      ['secret'],
      Object.assign(new Error('secret'), { code: 'ECONNREFUSED' })
    );
    const outer = new Error(`wrapped ${db.message}`, { cause: db });
    expect((safeError(outer) as Error).message).toBe(
      'Failed query: select $1 [ECONNREFUSED]'
    );
    const cycle = new Error('ordinary');
    cycle.cause = cycle;
    expect(safeError(cycle)).toBe(cycle);
  });

  it('does not copy malformed driver codes or unknown stack headers', () => {
    const error = new DrizzleQueryError(
      'select $1',
      ['secret'],
      Object.assign(new Error('bad'), { code: 'private value' })
    );
    error.stack = 'unrecognised header with secret';
    expect(inspect(safeError(error))).not.toContain('secret');
    expect(inspect(safeError(error))).not.toContain('private value');
  });

  it('cuts only at the first params marker and preserves ordinary errors', () => {
    expect(
      stripQueryParams('Failed query: select $1\nparams: secret\nparams: more')
    ).toBe('Failed query: select $1');
    const error = new Error('ordinary failure');
    expect(safeError(error)).toBe(error);
    expect(safeError(null)).toBeNull();
    expect(safeError('Failed query: select $1\nparams: secret')).toBe(
      'Failed query: select $1'
    );
  });
});
