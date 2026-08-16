/**
 * The three Call-2 modes, behind one `runCallTwo` call. `call-two.ts` wires the
 * stage around this; nothing outside the folder calls it directly.
 *
 *   - FAST PATH (D2): every ingredient is fully grounded (exact-match + server
 *     anchor, no prep notes) → skip the LLM, synthesize the estimation
 *     server-side. Numerically identical to the full path.
 *   - CHUNKED (D1): a large meal (> thresholds) → bounded-concurrency chunks
 *     with a wall-clock deadline + degrade-to-unresolved failure contract.
 *   - SINGLE CALL (default): the common case — ONE streamed Gemini request,
 *     byte-for-byte the pre-refactor behavior.
 *
 * The provider adapter (D3) is passed in, so the bakeoff can swap it; the
 * runtime always passes the Gemini adapter. Every mode's per-item client
 * events go out through `./item-macros`.
 */

import type { GeminiCallTrace } from '@/lib/ai/gemini';
import { NUTRITION_TIMEOUT_MS } from '@/lib/ai/pipeline/config/stage-timeouts';
import type { GroundedEstimation } from '@/lib/ai/pipeline/contracts/schemas/grounded-estimation';
import { shouldChunkCall2 } from '@/lib/ai/pipeline/estimator/chunk-policy';
import { runChunkedCall2 } from '@/lib/ai/pipeline/estimator/chunked-call2';
import type { GroundedEstimator } from '@/lib/ai/pipeline/estimator/types';
import type { MealItemWithCandidates } from '@/lib/ai/prompts/grounded-estimation';
import type { PromptPersonalizationContext } from '@/lib/ai/prompts/types';
import { fetchWithTimeout } from '@/lib/async/fetch-with-timeout';
import { type ChunkEmitContext, emitChunkItemMacros } from './item-macros';

/**
 * Absolute wall-clock budget for the WHOLE chunked Call-2 phase. Held BELOW the
 * route's `maxDuration=60s` (minus the ~20s already spent on decomposition +
 * matching + assembly headroom) so a large meal returns partial results rather
 * than dying past the route budget. Env-overridable for the bakeoff.
 */
export function chunkedPhaseDeadlineMs(): number {
  const raw = process.env.PIPELINE_CALL2_PHASE_DEADLINE_MS;
  const parsed = raw ? Number(raw) : Number.NaN;
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 40_000;
}

export interface CallTwoStreamDeps {
  /** Per-attempt streaming handler for the single-call path (identity-mapped). */
  handleChunk: (accumulated: string) => void;
  resetForRetry: () => void;
  onAttemptStart: (attempt: number) => void;
  onChunkTick: () => void;
}

export interface RunCallTwoArgs {
  estimator: GroundedEstimator;
  mealItems: MealItemWithCandidates[];
  originalPrompt: string;
  promptCtx: PromptPersonalizationContext;
  temperature: number;
  /** Single-call streaming hooks (unused by fast + chunked paths). */
  stream: CallTwoStreamDeps;
  /** Optional per-call trace for the single-call path. */
  trace?: GeminiCallTrace;
  /** Per-attempt token/error usage recorder (model-budget guards). */
  onAttemptComplete?: NonNullable<
    import('@/lib/ai/pipeline/estimator/types').GroundedEstimatorStreamHooks['onAttemptComplete']
  >;
  /** Chunked-path progressive item_macros emitter context. */
  chunkEmit: ChunkEmitContext;
}

export interface RunCallTwoResult {
  grounded: GroundedEstimation;
  mode: 'fast_path' | 'chunked' | 'single';
  chunkCount: number;
  failedChunkCount: number;
  failedMealItemNames: string[];
}

/**
 * Run Call 2. `fastPath`, when provided, is the pre-computed synthesized
 * estimation for a fully-grounded meal (the orchestrator decides eligibility
 * so it can also skip building the estimator). When absent, run chunked or
 * single-call against the estimator.
 */
export async function runCallTwo(
  args: RunCallTwoArgs & { fastPath?: GroundedEstimation }
): Promise<RunCallTwoResult> {
  if (args.fastPath) {
    // Emit item_macros for every item so the client still sees per-item
    // results even though no stream ran.
    emitChunkItemMacros(args.chunkEmit, args.fastPath.mealItems);
    return {
      grounded: args.fastPath,
      mode: 'fast_path',
      chunkCount: 0,
      failedChunkCount: 0,
      failedMealItemNames: [],
    };
  }

  if (shouldChunkCall2(args.mealItems)) {
    const result = await runChunkedCall2({
      estimator: args.estimator,
      mealItems: args.mealItems,
      originalPrompt: args.originalPrompt,
      userContext: args.promptCtx,
      temperature: args.temperature,
      phaseDeadlineMs: chunkedPhaseDeadlineMs(),
      onChunkComplete: (items) => emitChunkItemMacros(args.chunkEmit, items),
      onAttemptComplete: args.onAttemptComplete,
    });
    return {
      grounded: result.estimation,
      mode: 'chunked',
      chunkCount: result.chunkCount,
      failedChunkCount: result.failedChunkCount,
      failedMealItemNames: result.failedMealItemNames,
    };
  }

  // Single-call path — identical to the pre-refactor inline Gemini call.
  const grounded = await fetchWithTimeout(
    (signal) =>
      args.estimator
        .estimate(
          {
            originalPrompt: args.originalPrompt,
            mealItems: args.mealItems,
            userContext: args.promptCtx,
            temperature: args.temperature,
          },
          signal,
          {
            onAttemptStart: args.stream.onAttemptStart,
            onChunk: (accumulated) => {
              args.stream.onChunkTick();
              args.stream.handleChunk(accumulated);
            },
            ...(args.trace ? { trace: args.trace } : {}),
            ...(args.onAttemptComplete
              ? { onAttemptComplete: args.onAttemptComplete }
              : {}),
          }
        )
        .then((r) => r.estimation),
    NUTRITION_TIMEOUT_MS,
    'grounded-nutrition'
  );
  return {
    grounded,
    mode: 'single',
    chunkCount: 1,
    failedChunkCount: 0,
    failedMealItemNames: [],
  };
}
