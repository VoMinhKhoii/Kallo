import {
  buildLanguageCorrectionMessage,
  checkDecompositionLanguage,
} from '@/lib/ai/language/guard';
import { createMatchingPrewarm } from '@/lib/ai/matching/match-ingredients';
import {
  createStreamedMatching,
  type StreamedMatching,
} from '@/lib/ai/matching/streamed-matching';
import type { AnalyzeMealTraceContext } from '@/lib/ai/pipeline/analyze-meal';
import { readBooleanEnv } from '@/lib/ai/pipeline/config/feature-flags';
import type { ModelProfile } from '@/lib/ai/pipeline/config/model-profile';
import { DECOMPOSITION_TIMEOUT_MS } from '@/lib/ai/pipeline/config/stage-timeouts';
import {
  decompositionCallSchema,
  type MealDecompositionV2,
} from '@/lib/ai/pipeline/contracts/schemas/decomposition-v2';
import type { EstimatorAttemptUsage } from '@/lib/ai/pipeline/estimator/types';
import { buildLlmStageTrace } from '@/lib/ai/pipeline/telemetry/trace';
import {
  buildDecompositionV2Prompt,
  wrapUserMealTextAsData,
} from '@/lib/ai/prompts/build/decomposition-v2';
import { promptTraceName, resolvePromptLocale } from '@/lib/ai/prompts/locale';
import type { PromptPersonalizationContext } from '@/lib/ai/prompts/types';
import type { GeminiClient } from '@/lib/ai/provider/provider';
import type { StreamEvent } from '@/lib/ai/streaming/types';
import type { MealDecomposition } from '@/lib/ai/types/decomposition';
import type { UserContext } from '@/lib/ai/types/user-context';
import { fetchWithTimeout } from '@/lib/core/async/fetch-with-timeout';
import { capitalizeFirst } from '@/lib/core/text/capitalize';
import type { AppDb } from '@/lib/infra/db/client';
import { createDecompositionStreamController } from './decomposition-stream';
import { withStageLogV2 } from './stage-log';

type StreamedMealItemIds = ReturnType<
  ReturnType<
    typeof createDecompositionStreamController
  >['getStreamedMealItemIds']
>;

export type GroundedDecompositionResult =
  | { nonFood: true }
  | {
      nonFood: false;
      decomposition: MealDecompositionV2;
      streamedMealItemIds: StreamedMealItemIds;
      decomposeChunkCount: number;
      languageRetryCount: number;
      providerRetryCount: number;
      promptCharsCall1: number;
      /** Matching already started for the meal items Call 1 streamed. */
      streamedMatching: StreamedMatching;
    };

/**
 * v2 Stage 1: Call 1 — pure decomposition with item_name streaming. Buffers
 * item_name events until the language guard passes (same pattern as v1's
 * decomposition-stage) so a language-mismatch retry never leaks attempt-1's
 * names to the client, then capitalizes display names in place.
 */
export async function runGroundedDecomposition(args: {
  rawInput: string;
  userContext: UserContext;
  db: AppDb;
  gemini: GeminiClient;
  traceContext: AnalyzeMealTraceContext | undefined;
  emit: (event: StreamEvent) => void;
  promptCtx: PromptPersonalizationContext;
  profile: ModelProfile;
  /** Per-attempt token/error recorder (analysis model-budget guards). */
  onAttemptComplete?: (usage: EstimatorAttemptUsage) => void;
}): Promise<GroundedDecompositionResult> {
  const { rawInput, userContext, db, gemini, traceContext, emit, promptCtx } =
    args;
  const profile = args.profile;

  // Speculative prewarm: as Call 1 streams, warm the embeddings the matcher
  // will ask for (`createMatchingPrewarm`). Feature-flagged; on abort it stops
  // firing new embeds, and a prewarm error can never reject the stream.
  const prewarmEnabled = readBooleanEnv('PIPELINE_V2_PREWARM_ENABLED', true);
  const prewarmAbort = new AbortController();
  const warm = prewarmEnabled
    ? createMatchingPrewarm(db, gemini, prewarmAbort.signal)
    : () => {};
  // Each meal item is matched as soon as its object closes in the stream.
  const streamedMatching = createStreamedMatching(db, gemini);
  const prewarm = (accumulated: string) => {
    warm(accumulated);
    streamedMatching.onChunk(accumulated);
  };
  const decompositionInput = rawInput;

  const bufferedItemNameEvents: Array<
    Extract<StreamEvent, { type: 'item_name' }>
  > = [];
  const itemNameBufferingEmit = (event: StreamEvent) => {
    if (event.type === 'item_name') {
      bufferedItemNameEvents.push(event);
      return;
    }
    emit(event);
  };
  const flushBufferedItemNames = () => {
    for (const ev of bufferedItemNameEvents) emit(ev);
    bufferedItemNameEvents.length = 0;
  };
  let decompStream = createDecompositionStreamController({
    emit: itemNameBufferingEmit,
    prewarm,
  });
  const recreateDecompStream = () => {
    bufferedItemNameEvents.length = 0;
    decompStream = createDecompositionStreamController({
      emit: itemNameBufferingEmit,
      prewarm,
    });
  };

  let decomposeChunkCount = 0;
  let languageRetryCount = 0;
  let providerRetryCount = 0;

  const decompSystemPrompt = buildDecompositionV2Prompt(promptCtx);
  const promptCharsCall1 =
    decompSystemPrompt.length + decompositionInput.length;

  const runDecompositionAttempt = async (
    userMessage: string,
    stageLogId: string
  ): Promise<MealDecompositionV2> => {
    const callTrace = buildLlmStageTrace({
      trace: traceContext,
      stageLogId,
      name: promptTraceName(
        'decomposition-grounded',
        resolvePromptLocale(promptCtx)
      ),
      builder: buildDecompositionV2Prompt as (...a: unknown[]) => string,
      templateSample: decompSystemPrompt,
      model: profile.decompositionModel,
    });
    let maxAttempt = 0;
    const result = await fetchWithTimeout(
      (signal) => {
        // Propagate a decomposition timeout/abort to the prewarm so it stops
        // firing background embeds for an abandoned request.
        signal.addEventListener('abort', () => prewarmAbort.abort(), {
          once: true,
        });
        return gemini.generateStructuredOutputStream(
          {
            schema: decompositionCallSchema,
            systemPrompt: decompSystemPrompt,
            userMessage,
            model: profile.decompositionModel,
            temperature: 0.3,
            topP: 1,
            topK: 1,
            abortSignal: signal,
          },
          {
            onAttemptStart: (attempt) => {
              maxAttempt = Math.max(maxAttempt, attempt);
              if (attempt > 1) bufferedItemNameEvents.length = 0;
              decompStream.resetAttempt();
            },
            onChunk: (accumulated) => {
              decomposeChunkCount++;
              decompStream.handleChunk(accumulated);
            },
            ...(callTrace ? { trace: callTrace } : {}),
            ...(args.onAttemptComplete
              ? { onAttemptComplete: args.onAttemptComplete }
              : {}),
          }
        );
      },
      DECOMPOSITION_TIMEOUT_MS,
      'grounded-decomposition'
    ).catch((err: unknown) => {
      // A failed Call 1 fails the analysis: nothing will read what the
      // stream queued for matching.
      streamedMatching.close();
      throw err;
    });
    providerRetryCount += Math.max(0, maxAttempt - 1);
    const { plan: _plan, ...decomposition } = result;
    return decomposition;
  };

  let decomposition: MealDecompositionV2 = await withStageLogV2(
    traceContext,
    'decomposition',
    1,
    { rawInputLength: rawInput.length, model: profile.decompositionModel },
    ({ stageLogId }) => {
      emit({ type: 'stage', stage: 'decomposing' });
      return runDecompositionAttempt(
        wrapUserMealTextAsData(decompositionInput),
        stageLogId
      );
    }
  );

  // Language guard — mirrors v1 (decomposition-stage.ts language guard). Retries once
  // when the LLM emits Vietnamese for an English user (or vice versa).
  // Recreate the stream controller (NOT just resetAttempt) so the failed
  // attempt's mealItemIds + buffered events are fully discarded.
  let languageGuard = checkDecompositionLanguage(
    decomposition as unknown as MealDecomposition,
    userContext
  );
  if (!languageGuard.ok) {
    console.warn('[v2-pipeline] decomposition language mismatch; retrying', {
      expected: userContext.outputLanguage,
      actual: languageGuard.reason,
    });
    languageRetryCount += 1;
    recreateDecompStream();
    // Reset the telemetry probes so "decomposeChunkCount" reflects the
    // final (post-retry) attempt only.
    decomposeChunkCount = 0;
    decomposition = await withStageLogV2(
      traceContext,
      'decomposition',
      1,
      {
        rawInputLength: rawInput.length,
        model: profile.decompositionModel,
        languageRetry: true,
      },
      ({ stageLogId }) =>
        runDecompositionAttempt(
          buildLanguageCorrectionMessage(
            wrapUserMealTextAsData(decompositionInput),
            userContext
          ),
          stageLogId
        )
    );
    languageGuard = checkDecompositionLanguage(
      decomposition as unknown as MealDecomposition,
      userContext
    );
    if (!languageGuard.ok) {
      console.warn(
        '[v2-pipeline] decomposition language mismatch remained after retry',
        { expected: userContext.outputLanguage, actual: languageGuard.reason }
      );
    }
  }

  if (!decomposition.isFood || decomposition.mealItems.length === 0) {
    // Discard buffered item_name events — non-food input has no UI to update.
    bufferedItemNameEvents.length = 0;
    // Nothing will be matched; stop what the stream queued.
    streamedMatching.close();
    return { nonFood: true };
  }

  // Language guard passed — release buffered item_name events to the client.
  flushBufferedItemNames();

  // Capitalize meal-item and ingredient display names in place — same
  // pattern v1 uses (decomposition-stage.ts emitUnstreamed flush) so the UI always shows
  // titlecase regardless of how the user typed the input.
  for (const mi of decomposition.mealItems) {
    mi.name = capitalizeFirst(mi.name);
    for (const ing of mi.ingredients) {
      ing.rawName = capitalizeFirst(ing.rawName);
      ing.canonicalName = capitalizeFirst(ing.canonicalName);
    }
  }
  pinOnePartDishWeights(decomposition);

  return {
    nonFood: false,
    decomposition,
    streamedMealItemIds: decompStream.getStreamedMealItemIds(),
    decomposeChunkCount,
    languageRetryCount,
    providerRetryCount,
    promptCharsCall1,
    streamedMatching,
  };
}

/**
 * A one-part "dish" the user weighed ("almonds 100g") is that food's own typed
 * weight: Call 1 sometimes writes it on the dish instead of the food. In
 * place, the weight is copied to the food's `explicitMass` (unless it has its
 * own), so every later step reads it as a typed weight. It stays on the dish
 * too: the pinned food leaves scaling nothing to move, but if the dish rescue
 * replaces the food, its replacements are scaled back to it.
 */
export function pinOnePartDishWeights(
  decomposition: MealDecompositionV2
): void {
  for (const mi of decomposition.mealItems) {
    const [only, ...rest] = mi.ingredients;
    if (!mi.servedMassG || !only || rest.length > 0) continue;
    only.explicitMass ??= { grams: mi.servedMassG, basis: 'unknown' };
  }
}
