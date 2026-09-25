import { Errors } from '@/lib/core/errors/catalog';
import { findSqlState, SQL_STATE } from '@/lib/infra/db/sql-state';

/**
 * Postgres unique-violation detection. Matching walks Drizzle's `cause` chain
 * (see `sql-state.ts`): a bare `error.code === '23505'` check never matches in
 * production, so the violation would fall through to the generic retryable 500.
 */

/**
 * True when `error` (or anything on its `cause` chain) is a Postgres 23505.
 * With `constraint`, it must also name that constraint -- when the driver
 * reports one. An error without `constraint_name` still matches, so a caller
 * narrowing to a constraint never loses the mapping on a driver that omits it.
 */
export function isUniqueViolation(
  error: unknown,
  constraint?: string
): boolean {
  const violation = findSqlState(error, SQL_STATE.uniqueViolation);
  if (!violation) return false;
  if (!constraint || typeof violation.constraint_name !== 'string') return true;
  return violation.constraint_name === constraint;
}

/**
 * One message for every collision on a client-supplied meal id, whoever owns
 * the row. It must not vary with the owner: "already yours" versus "belongs to
 * someone else" would turn the endpoint into an oracle for which UUIDs exist
 * in other accounts. Retrying with the SAME id can never succeed, hence 409
 * (`retryable: false`) rather than the retryable 500 it used to fall through to.
 */
export const MEAL_ID_CONFLICT_MESSAGE =
  'Mã bữa ăn này đã được sử dụng. Hãy tạo mã mới rồi thử lại.';

/**
 * Run an insert into `meals` that may carry a client-generated id, mapping a
 * primary-key collision to a 409 `CONFLICT`. Only `meals_pkey` is mapped: a
 * unique violation from any other constraint is a server bug and keeps
 * surfacing as one.
 */
export async function guardClientMealId<T>(
  insert: () => PromiseLike<T>
): Promise<T> {
  try {
    return await insert();
  } catch (error) {
    if (isUniqueViolation(error, 'meals_pkey')) {
      throw Errors.conflict(MEAL_ID_CONFLICT_MESSAGE);
    }
    throw error;
  }
}
