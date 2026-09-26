import { DrizzleQueryError } from 'drizzle-orm/errors';
import { describe, expect, it } from 'vitest';
import {
  findSqlState,
  isForeignKeyViolation,
  SQL_STATE,
} from '@/lib/infra/db/sql-state';

/** The shape postgres-js throws. */
function pgError(code: string) {
  return Object.assign(new Error('pg error'), { code });
}

describe('findSqlState', () => {
  it('finds the SQLSTATE on the driver error itself', () => {
    const error = pgError(SQL_STATE.uniqueViolation);
    expect(findSqlState(error, SQL_STATE.uniqueViolation)).toBe(error);
  });

  it('walks the cause chain Drizzle wraps the driver error in', () => {
    const driver = pgError(SQL_STATE.foreignKeyViolation);
    const wrapped = new DrizzleQueryError('insert ...', [], driver);
    expect(findSqlState(wrapped, SQL_STATE.foreignKeyViolation)).toBe(driver);
  });

  it('returns null for another code or a non-object', () => {
    expect(
      findSqlState(pgError(SQL_STATE.uniqueViolation), '23503')
    ).toBeNull();
    expect(findSqlState('boom', SQL_STATE.uniqueViolation)).toBeNull();
    expect(findSqlState(null, SQL_STATE.uniqueViolation)).toBeNull();
  });
});

describe('isForeignKeyViolation', () => {
  it('matches a wrapped 23503 and nothing else', () => {
    const wrapped = new DrizzleQueryError(
      'insert ...',
      [],
      pgError(SQL_STATE.foreignKeyViolation)
    );
    expect(isForeignKeyViolation(wrapped)).toBe(true);
    expect(isForeignKeyViolation(pgError(SQL_STATE.uniqueViolation))).toBe(
      false
    );
    expect(isForeignKeyViolation(new Error('plain'))).toBe(false);
  });
});
