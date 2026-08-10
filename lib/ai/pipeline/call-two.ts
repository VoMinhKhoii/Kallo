/**
 * Stage 3 (Call 2) execution seam for the v2 orchestrator.
 *
 * Owns the three Call-2 modes so the orchestrator body stays small and under
 * the file-size ratchet:
 *   - FAST PATH (D2): every ingredient is fully grounded (exact-match + server
 *     anchor, no prep notes) → skip the LLM, synthesize the estimation
 *     server-side. Numerically identical to the full path.
 *   - CHUNKED (D1): a large meal (> thresholds) → bounded-concurrency chunks
 *     with a wall-clock deadline + degrade-to-unresolved failure contract.
 *   - SINGLE CALL (default): the common case — ONE streamed Gemini request,
 *     byte-for-byte the pre-refactor behavior.
 *
 * The provider adapter (D3) is passed in, so the bakeoff can swap it; the
 * runtime always passes the Gemini adapter.
 */

import { fetchWithTimeout } from '@/lib/fetch-with-timeout';
import { capitalizeFirst } from '@/lib/utils';
import type { GeminiCallTrace } from '../gemini';
import type { IngredientV2MatchResult } from '../matching/top-k-cascade';
import type { MealItemWithCandidates } from '../prompts/grounded-estimation';
import type { PromptPersonalizationContext } from '../prompts/types';
import {
  buildMealItemOffsetByName,
  type MealItemOffset,
  resolveStreamingV2MealItem,
} from '../streaming/grounded-parsers';
import { computeStreamingMealItem } from '../streaming/parsers';
import type { StreamEvent } from '../streaming/types';
import type { UserContext } from '../types';
import { NUTRITION_TIMEOUT_MS } from './config/stage-timeouts';
import { runChunkedCall2, shouldChunkCall2 } from './estimator/chunked-call2';
import type { GroundedEstimator } from './estimator/types';
import type { GroundedEstimation, GroundedMealItem } from './schemas-v2';

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
    import('./estimator/types').GroundedEstimatorStreamHooks['onAttemptComplete']
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

// ---------------------------------------------------------------------------
// Progressive item_macros for the fast + chunked paths.
// ---------------------------------------------------------------------------

export interface ChunkEmitContext {
  offsetByName: Map<string, MealItemOffset>;
  matchResults: IngredientV2MatchResult[];
  streamedMealItemIds: Map<string, string>;
  itemMacrosStreamed: Set<string>;
  goal: UserContext['goal'];
  aggression: UserContext['aggression'];
  emit: (event: StreamEvent) => void;
  /** Per-name occurrence counters (persist across chunk deliveries). */
  offsetOcc: Map<string, number>;
  idOcc: Map<string, number>;
  itemIndex: { value: number };
}

/** Build a fresh emit context. Occurrence counters start empty. */
export function createChunkEmitContext(args: {
  mealItems: Array<{
    name: string;
    ingredients: unknown[];
    cookingMethod: string;
  }>;
  matchResults: IngredientV2MatchResult[];
  streamedMealItemIds: Map<string, string>;
  itemMacrosStreamed: Set<string>;
  goal: UserContext['goal'];
  aggression: UserContext['aggression'];
  emit: (event: StreamEvent) => void;
}): ChunkEmitContext {
  return {
    offsetByName: buildMealItemOffsetByName(
      args.mealItems as Array<{
        name: string;
        ingredients: never[];
        cookingMethod: string;
      }>
    ),
    matchResults: args.matchResults,
    streamedMealItemIds: args.streamedMealItemIds,
    itemMacrosStreamed: args.itemMacrosStreamed,
    goal: args.goal,
    aggression: args.aggression,
    emit: args.emit,
    offsetOcc: new Map(),
    idOcc: new Map(),
    itemIndex: { value: 0 },
  };
}

/**
 * Emit `item_macros` for a batch of already-parsed grounded meal items,
 * resolving each to its decomposition slice by IDENTITY (name + occurrence) —
 * the same D4 mapping the single-call stream handler uses. De-dupes via the
 * shared `itemMacrosStreamed` set so the orchestrator's final flush never
 * double-emits.
 */
export function emitChunkItemMacros(
  ctx: ChunkEmitContext,
  items: GroundedMealItem[]
): void {
  for (const rawItem of items) {
    const offKey = rawItem.mealItemName.trim().toLocaleLowerCase('vi-VN');
    const offOcc = (ctx.offsetOcc.get(offKey) ?? 0) + 1;
    ctx.offsetOcc.set(offKey, offOcc);
    const offset = ctx.offsetByName.get(`${offKey}::${offOcc}`);
    if (!offset) continue;

    const { nutrition, totalGrams } = resolveStreamingV2MealItem(
      rawItem,
      offset.decomposedIngredients,
      offset.dishCookingMethod,
      ctx.matchResults,
      offset.flatIngredientStart
    );
    const streamItem = computeStreamingMealItem(
      nutrition,
      totalGrams,
      ctx.itemIndex.value,
      ctx.goal,
      ctx.aggression
    );
    ctx.itemIndex.value++;
    streamItem.name = capitalizeFirst(streamItem.name);

    const cap = capitalizeFirst(rawItem.mealItemName);
    const occ = (ctx.idOcc.get(cap) ?? 0) + 1;
    ctx.idOcc.set(cap, occ);
    const mealItemId =
      ctx.streamedMealItemIds.get(`${cap}::${occ}`) ??
      ctx.streamedMealItemIds.get(`${rawItem.mealItemName}::${occ}`) ??
      streamItem.id;
    if (ctx.itemMacrosStreamed.has(mealItemId)) continue;
    ctx.itemMacrosStreamed.add(mealItemId);
    ctx.emit({ type: 'item_macros', mealItemId, item: streamItem });
  }
}
