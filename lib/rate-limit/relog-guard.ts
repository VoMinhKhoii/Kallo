import { Errors } from '@/lib/errors';
import { checkAnalysisGuards } from '@/lib/rate-limit/analysis-guards';

/**
 * Per-user throttles for the relog surfaces.
 *
 * Relog incurs no AI cost, which is why it skips the billing gate — but
 * `checkAnalysisGuards` is not an AI-cost guard, it is a per-user request
 * limiter keyed on an arbitrary `route` string. `entitlements/reconcile` uses it
 * the same way on an ordinary REST route.
 *
 * What needs bounding here is DATABASE work, not spend:
 *
 *  - the candidates search runs two queries whose predicates are
 *    `lower(unaccent(col)) LIKE '%…%'` — a leading wildcard over a non-immutable
 *    function, so no index applies and the scan is bounded only by one user's
 *    365-day lookback, with window functions and a GROUP BY on top. It was
 *    previously defended by nothing but a CLIENT-side 300ms debounce, which curl
 *    ignores.
 *  - both write paths insert into `pending_analyses` / `meal_items` inside a
 *    transaction holding `FOR UPDATE` on the source meals.
 *
 * The pool this contends for is small by design (`DB_POOL_MAX` defaults to 2),
 * and starving it is what the analyze-meal SSE hang was traced to — so a
 * runaway relog client degrades far more than relog.
 */
const RELOG_GUARD_LIMITS = {
  /**
   * Interactive: fires on a 300ms debounce while the user types a dish name,
   * so the ceiling has to clear ordinary fast typing across several picker
   * sessions a minute. Concurrency is held at 2 because a single candidates
   * request already opens two connections (its arms run in parallel).
   */
  candidates: {
    perUserMinute: 60,
    perUserHour: 900,
    perUserDay: 5000,
    concurrentUser: 2,
    concurrentRetryAfterSeconds: 2,
  },
  /** Deliberate user actions — a human cannot log meals at this rate. */
  write: {
    perUserMinute: 12,
    perUserHour: 120,
    perUserDay: 500,
    concurrentUser: 1,
    concurrentRetryAfterSeconds: 5,
  },
} as const;

export type RelogGuardKind = keyof typeof RELOG_GUARD_LIMITS;

/**
 * ONE counter key for every relog write, shared by staging and the instant
 * save.
 *
 * `checkAnalysisGuards` keys its window and in-flight counters on the route
 * string, so giving each write action its own would hand a user an independent
 * `concurrentUser: 1` budget per action — two simultaneous transactions, each
 * holding `FOR UPDATE` on its source meals, against a pool that defaults to 2.
 * Exported as a constant precisely so a new write path cannot quietly invent a
 * third key.
 */
export const RELOG_WRITE_ROUTE = 'meals-relog-write';

/**
 * Run `work` under the relog throttle for `userId`.
 *
 * Lives in `lib/` and wraps the WORK rather than decorating a route, because
 * the REST routes are not the only entry point: the web composer calls
 * `loadRelogCandidatesAction` / `stageRelogAnalysisAction` as Server Actions
 * directly, and a guard that only wrapped the routes left that path completely
 * unthrottled — an authenticated caller could drive the unindexed candidate
 * scan and the `FOR UPDATE` write path as fast as they liked. Guarding inside
 * the action puts every client behind ONE limiter, and makes it impossible to
 * add a new caller that forgets to.
 *
 * Throws `Errors.rateLimited(…)` when throttled: a Server Action has no
 * `Response` to hand back, and `serializeError` turns the thrown error into the
 * same 429 + `Retry-After` the routes used to build by hand.
 *
 * The release runs in a `finally` here rather than at each call site — the
 * in-flight counter is what enforces `concurrentUser`, so leaking it locks the
 * user out of relog until the stale-counter sweep catches up.
 */
export async function withRelogGuard<T>(
  kind: RelogGuardKind,
  route: string,
  userId: string,
  work: () => Promise<T>
): Promise<T> {
  const guard = await checkAnalysisGuards({
    userId,
    route,
    limits: RELOG_GUARD_LIMITS[kind],
  });

  if (!guard.allowed) {
    throw Errors.rateLimited(undefined, guard.retryAfterSeconds);
  }

  try {
    return await work();
  } finally {
    await guard.release?.();
  }
}
