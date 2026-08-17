import { toJSONSchema } from 'zod';
import { createL4Cache } from '@/lib/ai/cache/l4-cache';
import {
  buildLanguageCorrectionMessage,
  checkDecompositionLanguage,
  type LanguageGuardResult,
} from '@/lib/ai/language/guard';
import { createSpeculativeMatcher } from '@/lib/ai/matching/speculative';
import type { AnalyzeMealTraceContext } from '@/lib/ai/pipeline/analyze-meal';
import { readBooleanEnv } from '@/lib/ai/pipeline/config/feature-flags';
import { resolveModelProfile } from '@/lib/ai/pipeline/config/model-profile';
import { DECOMPOSITION_TIMEOUT_MS } from '@/lib/ai/pipeline/config/stage-timeouts';
import { deriveExpectedState } from '@/lib/ai/pipeline/contracts/cooking-method-state';
import {
  ensureIdsOnDecomposition,
  type MealDecompositionWithIds,
} from '@/lib/ai/pipeline/contracts/decomposition-ids';
import {
  NON_FOOD_BLOCKLIST,
  NonFoodError,
} from '@/lib/ai/pipeline/contracts/failure';
import {
  ingredientCanonicalName as decompositionIngredientCanonicalName,
  ingredientDisplayName as decompositionIngredientName,
} from '@/lib/ai/pipeline/contracts/ingredient-accessors';
import { mealDecompositionSchema } from '@/lib/ai/pipeline/contracts/schemas/decomposition';
import { createDecompositionStreamController } from '@/lib/ai/pipeline/grounded/decomposition-stream';
import {
  createBudgetAttemptRecorder,
  type PipelineBudget,
} from '@/lib/ai/pipeline/telemetry/budget';
import { withStageLog } from '@/lib/ai/pipeline/telemetry/stage-log';
import { buildLlmStageTrace } from '@/lib/ai/pipeline/telemetry/trace';
import { getDecompositionPromptBuilder } from '@/lib/ai/prompts/build/decomposition';
import type { GeminiClient } from '@/lib/ai/provider/provider';
import type { StreamEvent } from '@/lib/ai/streaming/types';
import type { MealDecomposition } from '@/lib/ai/types/decomposition';
import type { UserContext } from '@/lib/ai/types/user-context';
import { fetchWithTimeout } from '@/lib/core/async/fetch-with-timeout';
import { capitalizeFirst } from '@/lib/core/text/capitalize';
import type { AppDb } from '@/lib/infra/db';
import {
  buildDecompositionCacheKey,
  sha256Hex,
  stableStringify,
} from './decomposition-cache';
import {
  type ValidationAnomaly,
  validateDecompositionOutput,
} from './validation';

/** Model for LLM Call 1 (decomposition). */
export const DECOMPOSITION_MODEL = resolveModelProfile().decompositionModel;

const L4_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const DECOMPOSITION_SCHEMA_HASH = sha256Hex(
  stableStringify(toJSONSchema(mealDecompositionSchema))
);
const L4_DECOMPOSITION_CACHE = createL4Cache<MealDecomposition>({
  maxEntries: 1000,
  ttlMs: L4_CACHE_TTL_MS,
});

export function _resetL4DecompositionCacheForTests(): void {
  L4_DECOMPOSITION_CACHE.clear();
}

type DecompositionLanguageMetadata = {
  inputLanguage: UserContext['inputLanguage'] | null;
  outputLanguage: UserContext['outputLanguage'] | null;
  guardReason: LanguageGuardResult['reason'];
  guardSeverity: LanguageGuardResult['severity'];
  guardPassed: boolean;
  retryCount: number;
};

function attachLanguageMetadata(
  decomposition: MealDecomposition,
  metadata: DecompositionLanguageMetadata
): MealDecomposition & { languageMetadata: DecompositionLanguageMetadata } {
  return { ...decomposition, languageMetadata: metadata };
}

export interface DecompositionStageResult {
  decomposition: MealDecompositionWithIds;
  decomposeMs: number;
  cacheHitL4: boolean;
  languageRetryCount: number;
  dbStateUnknownFires: number;
  decompositionAnomalies: ValidationAnomaly[];
  streamTimings: { extractAccumMs: number; chunkCount: number };
}

/**
 * Stage 1: streaming decomposition with speculative embedding pre-warming,
 * per-item name detection for progressive UI, L4 cache, and the language
 * guard (one retry). Emits `stage` and `item_name` events; throws
 * NonFoodError per D6 layers 1-2.
 */
export async function runDecompositionStage(args: {
  rawInput: string;
  userContext: UserContext;
  db: AppDb;
  gemini: GeminiClient;
  emit: (event: StreamEvent) => void;
  traceContext: AnalyzeMealTraceContext | undefined;
  budget: PipelineBudget;
  l4Cache?: { enabled?: boolean };
  /** Pipeline start timestamp — decomposeMs is measured from here. */
  stageStart: number;
}): Promise<DecompositionStageResult> {
  const { rawInput, userContext, db, gemini, emit, traceContext, budget } =
    args;

  emit({ type: 'stage', stage: 'decomposing' });
  const speculativePrewarmEnabled = readBooleanEnv(
    'PIPELINE_SPECULATIVE_PREWARM_ENABLED',
    true
  );
  const itemNameBufferEnabled = readBooleanEnv(
    'PIPELINE_ITEM_NAME_BUFFER_ENABLED',
    true
  );
  const speculativeMatcher = speculativePrewarmEnabled
    ? createSpeculativeMatcher(db, gemini)
    : () => undefined;
  const bufferedItemNameEvents: Extract<StreamEvent, { type: 'item_name' }>[] =
    [];
  // When buffering is disabled, item_name events stream directly. When
  // enabled, they are held until the language guard passes (or a retry
  // resets the buffer).
  const streamItemNames = (event: StreamEvent) => {
    if (itemNameBufferEnabled && event.type === 'item_name') {
      bufferedItemNameEvents.push(event);
      return;
    }

    emit(event);
  };
  let decompositionStream = createDecompositionStreamController({
    emit: streamItemNames,
    prewarm: speculativeMatcher,
  });
  const resetBufferedDecompositionStream = () => {
    bufferedItemNameEvents.length = 0;
    decompositionStream = createDecompositionStreamController({
      emit: streamItemNames,
      prewarm: speculativeMatcher,
    });
  };
  const flushBufferedItemNames = () => {
    for (const event of bufferedItemNameEvents) {
      emit(event);
    }
    bufferedItemNameEvents.length = 0;
  };
  let cacheHitL4 = false;
  let dbStateUnknownFires = 0;

  // Streaming policy (spec §4.4): item_name + item_macros stream incrementally.
  // On retry_step2, the second Call 2 re-emits item_macros; the client
  // overwrites by stable ids (§0.1). If retry_step2_count > 0 exceeds 10%
  // over a 7-day window (KPI block 8), revisit buffer-vs-stream.
  const decompositionPromptBuilder = getDecompositionPromptBuilder();
  const renderedDecompositionPrompt = decompositionPromptBuilder(userContext);
  // Default ON outside tests; PIPELINE_L4_DECOMPOSITION_CACHE_ENABLED=false
  // forces a cold-path decomposition without redeploying.
  const l4CacheEnabled =
    args.l4Cache?.enabled ??
    (process.env.NODE_ENV === 'test'
      ? false
      : readBooleanEnv('PIPELINE_L4_DECOMPOSITION_CACHE_ENABLED', true));
  const decompositionCacheKey = buildDecompositionCacheKey({
    rawInput,
    ctx: userContext,
    decompositionPromptHash: sha256Hex(renderedDecompositionPrompt),
    decompositionSchemaHash: DECOMPOSITION_SCHEMA_HASH,
    decompositionModel: DECOMPOSITION_MODEL,
  });
  let languageRetryCount = 0;

  const runDecompositionAttempt = async (
    userMessage: string,
    stageLogId: string
  ): Promise<MealDecomposition> => {
    const systemPrompt = renderedDecompositionPrompt;
    const callTrace = buildLlmStageTrace({
      trace: traceContext,
      stageLogId,
      name: 'decomposition',
      builder: decompositionPromptBuilder as (...a: unknown[]) => string,
      templateSample: systemPrompt,
      model: DECOMPOSITION_MODEL,
    });

    return fetchWithTimeout(
      (signal) =>
        gemini.generateStructuredOutputStream(
          {
            schema: mealDecompositionSchema,
            systemPrompt,
            userMessage,
            model: DECOMPOSITION_MODEL,
            temperature: 0.3,
            topP: 1,
            topK: 1,
            abortSignal: signal,
          },
          {
            onAttemptStart: decompositionStream.resetAttempt,
            onAttemptComplete: createBudgetAttemptRecorder({
              db,
              requestId: budget.requestId ?? null,
              workKind: budget.workKind,
              model: DECOMPOSITION_MODEL,
              providerErrorState: budget.providerErrorState,
            }),
            onChunk: decompositionStream.handleChunk,
            trace: callTrace,
          }
        ),
      DECOMPOSITION_TIMEOUT_MS,
      'decomposition'
    );
  };

  const rawDecomposition: MealDecomposition = await withStageLog(
    traceContext,
    'decomposition',
    1,
    { rawInput },
    async ({ stageLogId }) => {
      const l4LogKey = decompositionCacheKey.slice(0, 12);
      if (l4CacheEnabled) {
        const cached = L4_DECOMPOSITION_CACHE.get(decompositionCacheKey);
        if (cached) {
          const cachedDecomposition = structuredClone(cached);
          const cachedLanguageGuard = checkDecompositionLanguage(
            cachedDecomposition,
            userContext
          );
          if (cachedLanguageGuard.ok) {
            cacheHitL4 = true;
            console.info(`[pipeline] L4 HIT (key=${l4LogKey}…)`);
            return attachLanguageMetadata(cachedDecomposition, {
              inputLanguage: userContext.inputLanguage ?? null,
              outputLanguage: userContext.outputLanguage ?? null,
              guardReason: cachedLanguageGuard.reason,
              guardSeverity: cachedLanguageGuard.severity,
              guardPassed: cachedLanguageGuard.ok,
              retryCount: 0,
            });
          }
          // Cache poisoned with wrong-language output — drop and refetch.
          console.warn(
            `[pipeline] L4 HIT but language guard failed; treating as MISS (key=${l4LogKey}…)`,
            {
              expected: userContext.outputLanguage,
              actual: cachedLanguageGuard.reason,
            }
          );
        } else {
          console.info(`[pipeline] L4 MISS (key=${l4LogKey}…)`);
        }
      }

      let decomposed = await runDecompositionAttempt(rawInput, stageLogId);
      let languageGuard = checkDecompositionLanguage(decomposed, userContext);
      if (!languageGuard.ok) {
        const retryEnabled = readBooleanEnv(
          'PIPELINE_LANGUAGE_GUARD_RETRY_ENABLED',
          true
        );
        if (retryEnabled) {
          console.warn('[pipeline] decomposition language mismatch; retrying', {
            expected: userContext.outputLanguage,
            actual: languageGuard.reason,
          });
          languageRetryCount += 1;
          resetBufferedDecompositionStream();
          decomposed = await runDecompositionAttempt(
            buildLanguageCorrectionMessage(rawInput, userContext),
            stageLogId
          );
          languageGuard = checkDecompositionLanguage(decomposed, userContext);
          if (!languageGuard.ok) {
            console.warn(
              '[pipeline] decomposition language mismatch remained after retry',
              {
                expected: userContext.outputLanguage,
                actual: languageGuard.reason,
              }
            );
          }
        } else {
          console.warn(
            '[pipeline] decomposition language mismatch; retry disabled by flag',
            {
              expected: userContext.outputLanguage,
              actual: languageGuard.reason,
            }
          );
        }
      }
      if (l4CacheEnabled && languageGuard.ok) {
        L4_DECOMPOSITION_CACHE.set(
          decompositionCacheKey,
          structuredClone(decomposed)
        );
        console.info(`[pipeline] L4 STORE (key=${l4LogKey}…)`);
      } else if (l4CacheEnabled) {
        console.info(
          `[pipeline] L4 SKIP STORE (language guard failed) (key=${l4LogKey}…)`
        );
      }
      return attachLanguageMetadata(decomposed, {
        inputLanguage: userContext.inputLanguage ?? null,
        outputLanguage: userContext.outputLanguage ?? null,
        guardReason: languageGuard.reason,
        guardSeverity: languageGuard.severity,
        guardPassed: languageGuard.ok,
        retryCount: languageRetryCount,
      });
    }
  );
  // Thread streamed mealItemIds into the parsed decomposition before
  // `ensureIdsOnDecomposition` runs. This guarantees streamed `item_name`
  // ids match `item_macros` ids for the same logical slot (§0.1, §4.4).
  // Items that didn't appear in the stream (LLM held the whole tail until
  // close) get fresh compact ids minted by `ensureIdsOnDecomposition`.
  decompositionStream.applyParsedIds(rawDecomposition);
  const decomposition: MealDecompositionWithIds =
    ensureIdsOnDecomposition(rawDecomposition);
  const decomposeMs = Date.now() - args.stageStart;

  // Normalize names: capitalize first letter for consistent cache keys and UI display
  for (const mi of decomposition.mealItems) {
    mi.name = capitalizeFirst(mi.name);
    for (const ing of mi.ingredients) {
      ing.rawName = capitalizeFirst(decompositionIngredientName(ing));
      ing.canonicalName = capitalizeFirst(
        decompositionIngredientCanonicalName(ing)
      );
      const derived = deriveExpectedState({
        explicit: ing.expectedState,
        dishMethod: ing.cookingMethod ?? mi.cookingMethod,
        weightBasis: ing.weightBasis,
      });
      ing.expectedState = derived.state;
      ing._stateSource = derived.source;
      if (derived.source === 'unknown') {
        dbStateUnknownFires += 1;
      }
    }
  }

  // Note: alias resolution is now handled inside the matching cascade as a fallback
  // (try original name first, alias-expanded name second). No pre-match rewrite needed.

  // Flush: emit `item_name` for any meal items not already announced by the
  // streaming extractor. Iterating over `decomposition.mealItems` (post
  // `ensureIdsOnDecomposition`) guarantees each emit carries a stable
  // `mealItemId`.
  decompositionStream.emitUnstreamed(decomposition);
  flushBufferedItemNames();

  // D6 Layer 1: Check isFood field from LLM
  if (!decomposition.isFood) {
    throw new NonFoodError('Input is not food');
  }

  // D6 Layer 2: Post-parse blocklist sanity check
  for (const mi of decomposition.mealItems) {
    for (const ing of mi.ingredients) {
      const ingredientName = decompositionIngredientName(ing);
      if (NON_FOOD_BLOCKLIST.has(ingredientName.toLowerCase().trim())) {
        throw new NonFoodError(
          `Non-food ingredient detected: "${ingredientName}"`
        );
      }
    }
  }

  const decompositionAnomalies = validateDecompositionOutput(
    decomposition.mealItems
  );

  return {
    decomposition,
    decomposeMs,
    cacheHitL4,
    languageRetryCount,
    dbStateUnknownFires,
    decompositionAnomalies,
    streamTimings: decompositionStream.getStreamTimings(),
  };
}
