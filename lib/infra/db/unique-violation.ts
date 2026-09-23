import { Errors } from '@/lib/core/errors/catalog';

/**
 * Postgres unique-violation detection, shaped for how errors actually reach us.
 *
 * postgres-js throws a `PostgresError` carrying the SQLSTATE in `code` and the
 * violated constraint in `constraint_name`. Drizzle (0.44+) catches that and
 * rethrows a `DrizzleQueryError` whose `code` is undefined, with the original
 * error on `cause`. A bare `error.code === '23505'` check therefore silently
 * never matches in production, so the violation falls through to the generic
 * retryable 500. This walks the `cause` chain instead.
 */

const UNIQUE_VIOLATION = '23505';
const MAX_CAUSE_DEPTH = 5;

interface PgErrorLike {
  code?: unknown;
  constraint_name?: unknown;
  cause?: unknown;
}

function findUniqueViolation(error: unknown): PgErrorLike | null {
  let current: unknown = error;
  for (let depth = 0; depth < MAX_CAUSE_DEPTH; depth++) {
    if (typeof current !== 'object' || current === null) return null;
    const candidate = current as PgErrorLike;
    if (candidate.code === UNIQUE_VIOLATION) return candidate;
    current = candidate.cause;
  }
  return null;
}

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
  const violation = findUniqueViolation(error);
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
