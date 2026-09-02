import { Errors } from '@/lib/core/errors/catalog';
import { db } from '@/lib/infra/db/client';
import { analysisGuardEvents } from '@/lib/infra/db/schema';
import {
  buildAnalysisGuardEvent,
  checkAnalysisGuards,
} from '@/lib/infra/rate-limit/analysis-guards';
import { assertRateLimit } from '@/lib/infra/rate-limit/limiter/limiter';

/**
 * Per-user + global spend guard for nutrition-label OCR.
 *
 * OCR is the one authenticated surface that both spends Gemini quota AND does
 * expensive local work (a `sharp` decode of an uploaded photo) before the
 * provider call. So it needs two layers the ordinary `assertRateLimit` cannot
 * give on its own:
 *
 *  1. `checkAnalysisGuards` — the per-user window + CONCURRENCY slot the generic
 *     limiter has no concept of. One concurrent scan per user stops a single
 *     account from fanning out many parallel decodes against the 2-connection
 *     pool.
 *  2. `ocrGlobalDaily` — the app-wide Gemini-OCR budget. It is the ONLY
 *     `failMode: 'closed'` policy, so when the limiter cannot answer it throws
 *     `RateLimitUnavailableError` → 503. That is correct for a spend route:
 *     admitting with the guard down means spending money with no ceiling.
 *
 * **The order matters, and it is per-user FIRST.** The global budget is a
 * counter that is never refunded, so consuming it before the per-user check
 * meant a request the per-user guard was about to REFUSE still burned one unit
 * of the app-wide 5000/day budget. One trial account posting 5000 empty bodies
 * therefore took OCR away from everybody for the rest of the UTC day. Charging
 * it only after the per-user slot is held — and only immediately before the
 * provider call, once the body has been read, validated and decoded — means the
 * app-wide budget counts Gemini calls and nothing else.
 *
 * That is what `chargeGlobal` is for: `work` receives it and calls it at the
 * point where the next statement really does spend money. Everything before
 * that call still runs INSIDE the per-user slot, so the body read, the schema
 * validation and the `sharp` decode stay metered by the per-user window and by
 * `concurrentUser`.
 */
const OCR_SCAN_ROUTE = 'nutrition-label-scan';

const OCR_GUARD_LIMITS = {
  perUserMinute: 5,
  perUserHour: 30,
  perUserDay: 100,
  concurrentUser: 1,
  concurrentRetryAfterSeconds: 5,
} as const;

/** The app-wide Gemini-OCR budget, charged for one provider call. */
function chargeOcrGlobalBudget(): Promise<void> {
  return assertRateLimit('ocrGlobalDaily', { kind: 'global', value: 'ocr' });
}

/**
 * Run `work` under the OCR spend guard for `userId`.
 *
 * `work` is handed `chargeGlobal` and must call it immediately before the
 * Gemini request — see the ordering note above.
 *
 * Throws `RateLimitedError` (429) when the per-user window or concurrency slot
 * is exhausted, and `RateLimitUnavailableError` (503) when the global spend
 * budget's limiter is down — both flow through `mapNutritionLabelError`'s
 * pass-through default onto the standard envelope.
 *
 * The in-flight slot is released in a `finally` on EVERY exit — a validation
 * throw, a global-budget 429/503, a `work` failure and a success alike — and
 * the release is itself wrapped: a failed release must NEVER convert an
 * already-successful (already paid-for) Gemini result into a client error. A
 * leaked slot is reclaimed by the 90s stale-counter reset, so logging and
 * moving on is strictly better than surfacing a retry the caller would spend
 * Gemini quota on again.
 */
export async function withOcrGuard<T>(
  userId: string,
  work: (chargeGlobal: () => Promise<void>) => Promise<T>
): Promise<T> {
  const guard = await checkAnalysisGuards({
    userId,
    route: OCR_SCAN_ROUTE,
    limits: OCR_GUARD_LIMITS,
  });

  if (!guard.allowed) {
    // Fire-and-forget, like every other guard-event write: telemetry must never
    // fail (or delay) the 429 the caller is owed. Without this row an OCR block
    // was invisible in `analysis_guard_events`, so the one surface with a hard
    // spend ceiling was also the one with no trail of who hit it.
    db.insert(analysisGuardEvents)
      .values(
        buildAnalysisGuardEvent({
          userId,
          route: OCR_SCAN_ROUTE,
          reason: guard.reason,
          retryAfterSeconds: guard.retryAfterSeconds,
        })
      )
      .catch(console.error);

    throw Errors.rateLimited(undefined, guard.retryAfterSeconds);
  }

  try {
    return await work(chargeOcrGlobalBudget);
  } finally {
    try {
      await guard.release?.();
    } catch (error) {
      console.error('[ocr-guard] Failed to release in-flight slot:', error);
    }
  }
}
