import { capitalizeFirst } from '@/lib/utils';
import type { GeminiClient } from '../gemini';
import {
  buildLanguageCorrectionMessage,
  checkDecompositionLanguage,
} from '../language/guard';
import { buildDecompositionV2Prompt } from '../prompts/decomposition-v2';
import type { PromptPersonalizationContext } from '../prompts/types';
import type { StreamEvent } from '../streaming/types';
import type { MealDecomposition, UserContext } from '../types';
import type { ModelProfile } from './config/model-profile';
import { createDecompositionStreamController } from './decomposition-stream';
import { withStageLogV2 } from './grounded-support';
import type { AnalyzeMealTraceContext } from './orchestrator';
import {
  type MealDecompositionV2,
  mealDecompositionV2Schema,
} from './schemas-v2';
import { buildLlmStageTrace } from './telemetry/trace';

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
      promptCharsCall1: number;
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
  gemini: GeminiClient;
  traceContext: AnalyzeMealTraceContext | undefined;
  emit: (event: StreamEvent) => void;
  promptCtx: PromptPersonalizationContext;
  profile: ModelProfile;
}): Promise<GroundedDecompositionResult> {
  const { rawInput, userContext, gemini, traceContext, emit, promptCtx } = args;
  const profile = args.profile;

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
    prewarm: () => {},
  });
  const recreateDecompStream = () => {
    bufferedItemNameEvents.length = 0;
    decompStream = createDecompositionStreamController({
      emit: itemNameBufferingEmit,
      prewarm: () => {},
    });
  };

  let decomposeChunkCount = 0;
  let languageRetryCount = 0;

  const decompSystemPrompt = buildDecompositionV2Prompt(promptCtx);
  const promptCharsCall1 = decompSystemPrompt.length + rawInput.length;

  const runDecompositionAttempt = async (
    userMessage: string,
    stageLogId: string
  ): Promise<MealDecompositionV2> => {
    const callTrace = buildLlmStageTrace({
      trace: traceContext,
      stageLogId,
      name: 'decomposition-grounded',
      builder: buildDecompositionV2Prompt as (...a: unknown[]) => string,
      templateSample: decompSystemPrompt,
      model: profile.decompositionModel,
    });
    return gemini.generateStructuredOutputStream(
      {
        schema: mealDecompositionV2Schema,
        systemPrompt: decompSystemPrompt,
        userMessage,
        model: profile.decompositionModel,
        temperature: 0.3,
        topP: 1,
        topK: 1,
      },
      {
        onChunk: (accumulated) => {
          decomposeChunkCount++;
          decompStream.handleChunk(accumulated);
        },
        ...(callTrace ? { trace: callTrace } : {}),
      }
    );
  };

  let decomposition: MealDecompositionV2 = await withStageLogV2(
    traceContext,
    'decomposition',
    1,
    { rawInputLength: rawInput.length, model: profile.decompositionModel },
    ({ stageLogId }) => {
      emit({ type: 'stage', stage: 'decomposing' });
      return runDecompositionAttempt(rawInput, stageLogId);
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
          buildLanguageCorrectionMessage(rawInput, userContext),
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

  return {
    nonFood: false,
    decomposition,
    streamedMealItemIds: decompStream.getStreamedMealItemIds(),
    decomposeChunkCount,
    languageRetryCount,
    promptCharsCall1,
  };
}
