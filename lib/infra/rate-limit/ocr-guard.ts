import { createAiSpend } from '@/lib/ai/cost/ai-spend';
import {
  acquireRateLimit,
  assertRateLimit,
} from '@/lib/infra/rate-limit/limiter/limiter';

/**
 * Per-user + global spend guard for nutrition-label OCR.
 *
 * OCR is the one authenticated surface that both spends Gemini quota AND does
 * expensive local work (a `sharp` decode of an uploaded photo) before the
 * provider call. So it needs two layers the ordinary `assertRateLimit` cannot
 * give on its own:
 *
 *  1. `labelOcr` — the per-user windows + one-at-a-time slot, taken with
 *     `acquireRateLimit`. One concurrent scan per user stops a single account
 *     from fanning out many parallel decodes against the 2-connection pool.
 *  2. `ocrGlobalDaily` — the app-wide Gemini-OCR budget. It is the ONLY
 *     `failMode: 'closed'` policy, so when the limiter cannot answer it throws
 *     `RateLimitUnavailableError` → 503. That is correct for a spend route:
 *     admitting with the guard down means spending money with no ceiling.
 *
 * **The order matters, and it is per-user FIRST.** The global budget is a
 * counter that is never refunded, so consuming it before the per-user check
 * meant a request the per-user guard was about to REFUSE still burned one unit
 * of the app-wide 5000/day budget. One account posting 5000 empty bodies
 * therefore took OCR away from everybody for the rest of the UTC day. Charging
 * it only after the per-user slot is held — and only immediately before the
 * provider call, once the body has been read, validated and decoded — means the
 * app-wide budget counts Gemini calls and nothing else.
 *
 * That is what `chargeGlobal` is for: `work` receives it and calls it at the
 * point where the next statement really does spend money. Everything before
 * that call still runs INSIDE the per-user slot, so the body read, the schema
 * validation and the `sharp` decode stay metered by the per-user windows and
 * slot.
 */

/**
 * Run `work` under the OCR spend guard for `userId`.
 *
 * `work` is handed `chargeGlobal` and must call it immediately before the
 * Gemini request — see the ordering note above.
 *
 * Throws `RateLimitedError` (429) when the per-user window or concurrency slot
 * is exhausted or the app-wide AI brake has tripped, and
 * `RateLimitUnavailableError` (503) when the global spend budget's limiter or
 * the brake is down — all flow through `mapNutritionLabelError`'s
 * pass-through default onto the standard envelope.
 *
 * The in-flight slot is released in a `finally` on EVERY exit — a validation
 * throw, a global-budget 429/503, a `work` failure and a success alike — and
 * the release never throws: a failed release must NEVER convert an
 * already-successful (already paid-for) Gemini result into a client error. A
 * leaked slot frees itself when `labelOcr`'s slot lifetime
 * (`limiter/policy-sets/spend.ts`) runs out, so logging and
 * moving on is strictly better than surfacing a retry the caller would spend
 * Gemini quota on again.
 */
export async function withOcrGuard<T>(
  userId: string,
  work: (chargeGlobal: () => Promise<void>) => Promise<T>
): Promise<T> {
  const lease = await acquireRateLimit('labelOcr', {
    kind: 'user',
    value: userId,
  });

  // The scan also spends under the app-wide AI brake. Reserved inside
  // `chargeGlobal`, so a body that never reaches the provider reserves
  // nothing; the provider call runs metered and settles in the `finally`.
  const spend = createAiSpend('labelOcr', { userId });
  const chargeGlobal = async () => {
    await assertRateLimit('ocrGlobalDaily', { kind: 'global', value: 'ocr' });
    await spend.reserve();
  };

  try {
    return await spend.run(() => work(chargeGlobal));
  } finally {
    await spend.settle();
    await lease.release();
  }
}
