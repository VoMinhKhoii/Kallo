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

export interface RelogGuardOutcome {
  /** Present when throttled — hand it straight back to the client. */
  blocked?: Response;
  /**
   * The caller MUST invoke this in a `finally`. The in-flight counter is what
   * enforces `concurrentUser`, so leaking it locks the user out of relog until
   * the stale-counter sweep catches up.
   */
  release?: () => Promise<void> | void;
}

/** Throttle one relog request. */
export async function guardRelogRequest(
  kind: RelogGuardKind,
  route: string,
  userId: string
): Promise<RelogGuardOutcome> {
  const guard = await checkAnalysisGuards({
    userId,
    route,
    limits: RELOG_GUARD_LIMITS[kind],
  });

  if (!guard.allowed) {
    return {
      blocked: Response.json(Errors.rateLimited().toJSON(), {
        status: guard.status,
        headers: { 'Retry-After': String(guard.retryAfterSeconds) },
      }),
    };
  }
  return { release: guard.release };
}
