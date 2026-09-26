/**
 * Postgres SQLSTATE detection, shaped for how errors actually reach us.
 *
 * postgres-js throws a `PostgresError` carrying the SQLSTATE in `code` and the
 * violated constraint in `constraint_name`. Drizzle (0.44+) catches that and
 * rethrows a `DrizzleQueryError` whose `code` is undefined, with the original
 * error on `cause`. A bare `error.code === '23505'` check therefore silently
 * never matches in production. This walks the `cause` chain instead.
 */

export const SQL_STATE = {
  foreignKeyViolation: '23503',
  uniqueViolation: '23505',
} as const;

const MAX_CAUSE_DEPTH = 5;

export interface PgErrorLike {
  code?: unknown;
  constraint_name?: unknown;
  cause?: unknown;
}

/** The first error on `error`'s cause chain carrying `sqlState`, or null. */
export function findSqlState(
  error: unknown,
  sqlState: string
): PgErrorLike | null {
  let current: unknown = error;
  for (let depth = 0; depth < MAX_CAUSE_DEPTH; depth++) {
    if (typeof current !== 'object' || current === null) return null;
    const candidate = current as PgErrorLike;
    if (candidate.code === sqlState) return candidate;
    current = candidate.cause;
  }
  return null;
}

/** True when `error` (or anything on its cause chain) is a Postgres 23503. */
export function isForeignKeyViolation(error: unknown): boolean {
  return findSqlState(error, SQL_STATE.foreignKeyViolation) !== null;
}
