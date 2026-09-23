import { DrizzleQueryError } from 'drizzle-orm/errors';
import { describe, expect, it } from 'vitest';
import {
  guardClientMealId,
  isUniqueViolation,
  MEAL_ID_CONFLICT_MESSAGE,
} from '@/lib/infra/db/unique-violation';

/** The shape postgres-js throws for a unique violation. */
function pgError(code: string, constraint_name?: string) {
  return Object.assign(new Error('duplicate key value'), {
    code,
    constraint_name,
  });
}

/** What actually reaches app code: Drizzle wraps the driver error. */
function wrapped(cause: Error) {
  return new DrizzleQueryError('insert into "meals" ...', [], cause);
}

describe('isUniqueViolation', () => {
  it('matches a bare postgres-js 23505', () => {
    expect(isUniqueViolation(pgError('23505'))).toBe(true);
  });

  // The bug this helper exists for: Drizzle 0.44+ puts the SQLSTATE on
  // `cause`, so `error.code === '23505'` never matched in production.
  it('matches a 23505 wrapped in a DrizzleQueryError', () => {
    const error = wrapped(pgError('23505', 'meals_pkey'));
    expect((error as { code?: string }).code).toBeUndefined();
    expect(isUniqueViolation(error)).toBe(true);
  });

  it('rejects other SQLSTATEs and non-errors', () => {
    expect(isUniqueViolation(wrapped(pgError('23503')))).toBe(false);
    expect(isUniqueViolation(new Error('boom'))).toBe(false);
    expect(isUniqueViolation(null)).toBe(false);
    expect(isUniqueViolation('23505')).toBe(false);
  });

  it('narrows to a constraint when the driver names one', () => {
    const pkey = wrapped(pgError('23505', 'meals_pkey'));
    const other = wrapped(pgError('23505', 'meal_shares_meal_id_key'));
    expect(isUniqueViolation(pkey, 'meals_pkey')).toBe(true);
    expect(isUniqueViolation(other, 'meals_pkey')).toBe(false);
    expect(isUniqueViolation(pgError('23505'), 'meals_pkey')).toBe(true);
  });
});

describe('guardClientMealId', () => {
  it('returns the insert result untouched', async () => {
    await expect(
      guardClientMealId(async () => [{ id: 'm1' }])
    ).resolves.toEqual([{ id: 'm1' }]);
  });

  it('maps a meals_pkey collision to a non-retryable 409', async () => {
    const rejection = guardClientMealId(async () => {
      throw wrapped(pgError('23505', 'meals_pkey'));
    });

    await expect(rejection).rejects.toMatchObject({
      code: 'CONFLICT',
      status: 409,
      retryable: false,
      message: MEAL_ID_CONFLICT_MESSAGE,
    });
  });

  it('leaves any other failure alone', async () => {
    const other = wrapped(pgError('23505', 'meal_shares_meal_id_key'));
    await expect(
      guardClientMealId(async () => {
        throw other;
      })
    ).rejects.toBe(other);
  });
});
