/**
 * Stage 3 of the grounded run — Call 2, grounded estimation.
 *
 * The folder's public entry: builds the provider adapter, renders the
 * estimation prompt, wires the progressive `item_macros` emitters, and runs
 * `runCallTwo` (fast / chunked / single, see `./modes`) inside the `nutrition`
 * stage log. Returns the estimation plus the streaming state the orchestrator
 * needs for its post-assembly flush.
 */

import type { IngredientV2MatchResult } from '@/lib/ai/matching/retrieve/top-k-cascade';
import type { AnalyzeMealTraceContext } from '@/lib/ai/pipeline/analyze-meal';
import type { ModelProfile } from '@/lib/ai/pipeline/config/model-profile';
import type { MealDecompositionV2 } from '@/lib/ai/pipeline/contracts/schemas/decomposition-v2';
import type { GroundedEstimation } from '@/lib/ai/pipeline/contracts/schemas/grounded-estimation';
import {
  createGeminiEstimator,
  renderGeminiEstimatorPrompt,
} from '@/lib/ai/pipeline/estimator/gemini-estimator';
import type { GroundedEstimator } from '@/lib/ai/pipeline/estimator/types';
import { buildLlmStageTrace } from '@/lib/ai/pipeline/telemetry/trace';
import type { MealItemWithCandidates } from '@/lib/ai/prompts/build/grounded-candidates';
import { promptTraceName, resolvePromptLocale } from '@/lib/ai/prompts/locale';
import type { PromptPersonalizationContext } from '@/lib/ai/prompts/types';
import type { GeminiClient } from '@/lib/ai/provider/provider';
import type { MealItemOffset } from '@/lib/ai/streaming/grounded-parsers';
import { buildMealItemOffsetByName } from '@/lib/ai/streaming/grounded-parsers';
import type { StreamEvent } from '@/lib/ai/streaming/types';
import type { UserContext } from '@/lib/ai/types/user-context';
import { withStageLogV2 } from '../stage-log';
import {
  createCall2StreamHandler,
  createChunkEmitContext,
} from './item-macros';
import { type RunCallTwoResult, runCallTwo } from './modes';

export interface CallTwoStageResult {
  call2: RunCallTwoResult;
  grounded: GroundedEstimation;
  /** Prompt size probe for the run record. */
  promptCharsCall2: number;
  /** Highest provider attempt seen; `- 1` is the retry count. */
  nutritionMaxAttempt: number;
  /** D4 name+occurrence → decomposition slice map, reused by the final flush. */
  offsetByName: Map<string, MealItemOffset>;
  /** Ids already emitted, so the final flush cannot double-emit. */
  itemMacrosStreamed: Set<string>;
}

export async function runCallTwoStage(args: {
  traceContext: AnalyzeMealTraceContext | undefined;
  emit: (event: StreamEvent) => void;
  gemini: GeminiClient;
  profile: ModelProfile;
  /** Offline-eval override; production leaves this undefined (Gemini). */
  estimatorOverride: GroundedEstimator | undefined;
  decomposition: MealDecompositionV2;
  matchResults: IngredientV2MatchResult[];
  mealItemsWithCandidates: MealItemWithCandidates[];
  streamedMealItemIds: Map<string, string>;
  rawInput: string;
  promptCtx: PromptPersonalizationContext;
  temperature: number;
  userContext: UserContext;
  onAttemptComplete: NonNullable<
    Parameters<typeof runCallTwo>[0]['onAttemptComplete']
  >;
  onChunkTick: () => void;
}): Promise<CallTwoStageResult> {
  const {
    traceContext,
    emit,
    decomposition,
    matchResults,
    mealItemsWithCandidates,
    streamedMealItemIds,
    rawInput,
    promptCtx,
    userContext,
  } = args;

  const estimator =
    args.estimatorOverride ??
    createGeminiEstimator(args.gemini, args.profile.nutritionModel);
  const call2SystemPrompt = renderGeminiEstimatorPrompt({
    originalPrompt: rawInput,
    mealItems: mealItemsWithCandidates,
    userContext: promptCtx,
    temperature: args.temperature,
  });
  const promptCharsCall2 = call2SystemPrompt.length;

  // D4: Call 2 streams meal items in the prompt's SORTED order; the stream
  // handler attributes each item to its slice by name+occurrence.
  const offsetByName = buildMealItemOffsetByName(decomposition.mealItems);
  const itemMacrosStreamed = new Set<string>();
  const call2Stream = createCall2StreamHandler({
    offsetByName,
    matchResults,
    streamedMealItemIds,
    itemMacrosStreamed,
    goal: userContext.goal,
    aggression: userContext.aggression,
    emit,
  });
  const chunkEmit = createChunkEmitContext({
    mealItems: decomposition.mealItems,
    matchResults,
    streamedMealItemIds,
    itemMacrosStreamed,
    goal: userContext.goal,
    aggression: userContext.aggression,
    emit,
  });

  let nutritionMaxAttempt = 0;
  const call2 = await withStageLogV2(
    traceContext,
    'nutrition',
    3,
    {
      mealItemCount: decomposition.mealItems.length,
      matchedCount: matchResults.filter((m) => m.candidates.length > 0).length,
      unmatchedCount: matchResults.filter((m) => m.candidates.length === 0)
        .length,
      model: args.profile.nutritionModel,
    },
    async ({ stageLogId }) => {
      emit({ type: 'stage', stage: 'estimating' });
      const callTrace = buildLlmStageTrace({
        trace: traceContext,
        stageLogId,
        name: promptTraceName(
          'grounded-estimation',
          resolvePromptLocale(promptCtx)
        ),
        builder: renderGeminiEstimatorPrompt as (...a: unknown[]) => string,
        templateSample: call2SystemPrompt,
        model: args.profile.nutritionModel,
      });
      return runCallTwo({
        estimator,
        mealItems: mealItemsWithCandidates,
        originalPrompt: rawInput,
        promptCtx,
        temperature: args.temperature,
        stream: {
          handleChunk: call2Stream.handleChunk,
          resetForRetry: call2Stream.resetForRetry,
          onAttemptStart: (attempt) => {
            nutritionMaxAttempt = Math.max(nutritionMaxAttempt, attempt);
            if (attempt > 1) call2Stream.resetForRetry();
          },
          onChunkTick: args.onChunkTick,
        },
        chunkEmit,
        onAttemptComplete: args.onAttemptComplete,
        ...(callTrace ? { trace: callTrace } : {}),
      });
    }
  );

  return {
    call2,
    grounded: call2.grounded,
    promptCharsCall2,
    nutritionMaxAttempt,
    offsetByName,
    itemMacrosStreamed,
  };
}
