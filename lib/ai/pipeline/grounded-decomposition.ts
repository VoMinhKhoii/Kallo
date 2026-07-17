import type { AppDb } from '@/lib/db';
import { fetchWithTimeout } from '@/lib/fetch-with-timeout';
import { capitalizeFirst } from '@/lib/utils';
import type { GeminiClient } from '../gemini';
import {
  buildLanguageCorrectionMessage,
  checkDecompositionLanguage,
} from '../language/guard';
import { createV2SpeculativeMatcher } from '../matching/speculative';
import { readBooleanEnv } from './config/feature-flags';
import {
  buildDecompositionV2Prompt,
  wrapUserMealTextAsData,
} from '../prompts/decomposition-v2';
import type { PromptPersonalizationContext } from '../prompts/types';
import type { StreamEvent } from '../streaming/types';
import type { MealDecomposition, UserContext } from '../types';
import type { ModelProfile } from './config/model-profile';
import { DECOMPOSITION_TIMEOUT_MS } from './config/stage-timeouts';
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

/**
 * Append a precise-mode clarify reply to the original meal text as an extra
 * data line, so Call 1 re-decomposes with the portion/food answer in hand.
 * Both halves are user-authored DATA — the decomposition system prompt's
 * delimiter rule guards against embedded instructions.
 */
function buildClarifiedDecompositionInput(
  rawInput: string,
  clarifyAnswer: string
): string {
  const answer = clarifyAnswer.trim();
  if (!answer) return rawInput;
  return `${rawInput}\n(clarification: ${answer})`;
}

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
  /** Reply to a prior precise-mode clarify question; woven into the Call-1 message. */
  clarifyAnswer?: string;
}): Promise<GroundedDecompositionResult> {
  const { rawInput, userContext, db, gemini, traceContext, emit, promptCtx } =
    args;
  const profile = args.profile;

  // v2-aware speculative prewarm: as Call-1 decomposition streams, warm the
  // embedding cache for each ingredient's canonicalName in the background so
  // embeddings are ready when matching runs. Feature-flagged; on abort the
  // matcher stops firing new embeds. A prewarm error can never reject the
  // stream (the matcher is fully catch-guarded).
  const prewarmEnabled = readBooleanEnv('PIPELINE_V2_PREWARM_ENABLED', true);
  const prewarmAbort = new AbortController();
  const prewarm = prewarmEnabled
    ? createV2SpeculativeMatcher(db, gemini, prewarmAbort.signal)
    : () => {};
  // Weave a clarify reply into the Call-1 user message so the re-analysis
  // reasons with the answer (mirrors cheat mode threading clarifyAnswer into
  // its prompt). Sanitized to keep it DATA, never instructions.
  const decompositionInput = args.clarifyAnswer
    ? buildClarifiedDecompositionInput(rawInput, args.clarifyAnswer)
    : rawInput;

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
      name: 'decomposition-grounded',
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
            schema: mealDecompositionV2Schema,
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
          }
        );
      },
      DECOMPOSITION_TIMEOUT_MS,
      'grounded-decomposition'
    );
    providerRetryCount += Math.max(0, maxAttempt - 1);
    return result;
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
    providerRetryCount,
    promptCharsCall1,
  };
}
