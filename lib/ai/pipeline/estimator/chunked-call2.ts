/**
 * D1 — chunked / bounded-concurrency Call 2 for large meals.
 *
 * The problem: Call 2 sends ALL meal items in one streamed request. A 28-dish
 * meal measured 64s in staging, past the 60s Cloud Run route budget → the
 * request can die and return nothing. This module runs Call 2 as
 * bounded-concurrency chunks with a real failure contract so a large meal
 * still returns (partial if need be) inside the deadline. The partition itself
 * — the thresholds and the item-atomic packing — lives in `chunk-policy.ts`.
 *
 * Failure contract (the adversarial review demanded all of these):
 *   - Chunk by MEAL ITEM — an item's ingredients never split across chunks.
 *   - Bounded chunk concurrency (small, default 3).
 *   - An absolute wall-clock deadline for the whole Call-2 phase, inside the
 *     route's maxDuration; each chunk gets an AbortSignal derived from it.
 *   - Per-chunk retry cap (the provider client also retries internally; this
 *     is the phase-level cap on top of a hard chunk failure).
 *   - `Promise.allSettled` semantics with a DETERMINISTIC merge: results are
 *     reassembled in ORIGINAL meal order regardless of completion order, keyed
 *     by meal-item IDENTITY (name + occurrence) — the Phase-4 mapping.
 *   - A chunk that fails after retries does NOT fail the whole meal: its meal
 *     items are simply ABSENT from the merged estimation, so the bridge routes
 *     their ingredients through the unresolved_estimate (Phase-1/3) path and
 *     the rest of the meal still returns.
 *
 * Small meals keep the single-call path — see `shouldChunkCall2`.
 */

import type {
  GroundedEstimation,
  GroundedMealItem,
} from '@/lib/ai/pipeline/contracts/schemas/grounded-estimation';
import type { MealItemWithCandidates } from '@/lib/ai/prompts/grounded-estimation';
import type { PromptPersonalizationContext } from '@/lib/ai/prompts/types';
import { fetchWithTimeout } from '@/lib/async/fetch-with-timeout';
import { mapWithConcurrency } from '@/lib/async/map-with-concurrency';
import {
  CHUNK_CONCURRENCY,
  CHUNK_MAX_ATTEMPTS,
  chunkMealItems,
} from './chunk-policy';
import type { GroundedEstimator, GroundedEstimatorInput } from './types';

export interface ChunkedCall2Result {
  estimation: GroundedEstimation;
  /** Chunks that failed after retries (their meal items are absent → unresolved). */
  failedChunkCount: number;
  /** Meal-item names that failed (for telemetry / degraded-UX flagging). */
  failedMealItemNames: string[];
  chunkCount: number;
}

export interface RunChunkedCall2Args {
  estimator: GroundedEstimator;
  mealItems: MealItemWithCandidates[];
  originalPrompt: string;
  userContext: PromptPersonalizationContext;
  temperature: number;
  /** Absolute wall-clock budget for the WHOLE Call-2 phase (ms). */
  phaseDeadlineMs: number;
  /**
   * Per-completed-chunk sink so item_macros still emit progressively as chunks
   * land (identity-mapped downstream). Receives the chunk's parsed meal items.
   */
  onChunkComplete?: (mealItems: GroundedMealItem[]) => void;
  /** Per-attempt token/error usage recorder (model-budget guards). */
  onAttemptComplete?: NonNullable<
    import('./types').GroundedEstimatorStreamHooks['onAttemptComplete']
  >;
  concurrency?: number;
  maxAttempts?: number;
}

/**
 * Run Call 2 in bounded-concurrency chunks against `estimator`, honoring the
 * failure contract above. Returns a merged `GroundedEstimation` in ORIGINAL
 * meal-item order (deterministic regardless of completion order), plus the
 * failure bookkeeping the orchestrator telemeters.
 */
export async function runChunkedCall2(
  args: RunChunkedCall2Args
): Promise<ChunkedCall2Result> {
  const {
    estimator,
    mealItems,
    originalPrompt,
    userContext,
    temperature,
    phaseDeadlineMs,
    onChunkComplete,
  } = args;
  const concurrency = args.concurrency ?? CHUNK_CONCURRENCY;
  const maxAttempts = args.maxAttempts ?? CHUNK_MAX_ATTEMPTS;

  const chunks = chunkMealItems(mealItems);
  const phaseStart = Date.now();

  // Each chunk resolves to its parsed meal items, or null on hard failure.
  const settled = await mapWithConcurrency(
    chunks,
    (chunk) =>
      runOneChunk({
        estimator,
        chunk,
        originalPrompt,
        userContext,
        temperature,
        phaseStart,
        phaseDeadlineMs,
        maxAttempts,
        onChunkComplete,
        onAttemptComplete: args.onAttemptComplete,
      }),
    concurrency
  );

  // DETERMINISTIC merge: walk chunks in ORIGINAL order and, within each chunk,
  // meal items in original order. mapWithConcurrency preserves input order, so
  // completion order never affects the merged result.
  const mergedMealItems: GroundedMealItem[] = [];
  const failedMealItemNames: string[] = [];
  let failedChunkCount = 0;

  settled.forEach((r, i) => {
    const parsed = r.status === 'fulfilled' ? r.value : null;
    if (parsed) {
      mergedMealItems.push(...parsed);
      return;
    }
    // Hard chunk failure (rejected OR returned null): its meal items are
    // ABSENT from the estimation. The bridge sees them as verdict='missing'
    // and routes their ingredients to unresolved_estimate — the meal still
    // returns with those items flagged, not a 500.
    failedChunkCount++;
    for (const mi of chunks[i]) failedMealItemNames.push(mi.mealItem.name);
  });

  return {
    estimation: { mealItems: mergedMealItems },
    failedChunkCount,
    failedMealItemNames,
    chunkCount: chunks.length,
  };
}

async function runOneChunk(args: {
  estimator: GroundedEstimator;
  chunk: MealItemWithCandidates[];
  originalPrompt: string;
  userContext: PromptPersonalizationContext;
  temperature: number;
  phaseStart: number;
  phaseDeadlineMs: number;
  maxAttempts: number;
  onChunkComplete?: (mealItems: GroundedMealItem[]) => void;
  /** Per-attempt token/error usage recorder (model-budget guards). */
  onAttemptComplete?: NonNullable<
    import('./types').GroundedEstimatorStreamHooks['onAttemptComplete']
  >;
}): Promise<GroundedMealItem[] | null> {
  const input: GroundedEstimatorInput = {
    originalPrompt: args.originalPrompt,
    mealItems: args.chunk,
    userContext: args.userContext,
    temperature: args.temperature,
  };

  for (let attempt = 1; attempt <= args.maxAttempts; attempt++) {
    // Remaining wall-clock budget for the WHOLE phase. Once it's spent, stop
    // retrying — a late chunk degrades to unresolved rather than blowing the
    // route budget.
    const remaining = args.phaseDeadlineMs - (Date.now() - args.phaseStart);
    if (remaining <= 0) return null;
    try {
      const result = await fetchWithTimeout(
        (signal) =>
          args.estimator.estimate(
            input,
            signal,
            args.onAttemptComplete
              ? { onAttemptComplete: args.onAttemptComplete }
              : undefined
          ),
        remaining,
        'grounded-nutrition-chunk'
      );
      // Callback failures are OUR bug (emitter/parser), not the provider's —
      // never let them re-trigger a provider retry or discard a valid chunk.
      try {
        args.onChunkComplete?.(result.estimation.mealItems);
      } catch (callbackErr) {
        console.error(
          '[v2-pipeline] chunk onChunkComplete callback failed (chunk kept):',
          callbackErr
        );
      }
      return result.estimation.mealItems;
    } catch (err) {
      const isLast = attempt >= args.maxAttempts;
      console.warn(
        `[v2-pipeline] Call-2 chunk attempt ${attempt}/${args.maxAttempts} failed` +
          `${isLast ? ' (degrading its items to unresolved)' : ', retrying'}:`,
        err instanceof Error ? err.message : err
      );
      if (isLast) return null;
    }
  }
  return null;
}
