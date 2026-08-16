import { fetchWithTimeout } from '@/lib/async/fetch-with-timeout';
import type { AppDb } from '@/lib/db';
import { capitalizeFirst } from '@/lib/text/capitalize';
import type { GeminiClient } from '../gemini';
import type { matchIngredients } from '../matching';
import { getNutritionPromptBuilder } from '../prompts';
import {
  computeStreamingMealItem,
  extractCompletedMealItemNutrition,
} from '../streaming/parsers';
import type { StreamEvent } from '../streaming/types';
import type { NutritionAdjustment, UserContext } from '../types';
import {
  createBudgetAttemptRecorder,
  type PipelineBudget,
} from './budget-telemetry';
import {
  assertMealFactsShape,
  type MealFactsForComputePolicy,
  pickComputePolicy,
  summarizeCandidateConfidence,
} from './config/compute-policy';
import type { ModelProfile } from './config/model-profile';
import { NUTRITION_TIMEOUT_MS } from './config/stage-timeouts';
import { createCompactIdSequence } from './id-sequence';
import type { MealDecompositionWithIds } from './ids';
import { ingredientGrams as decompositionIngredientGrams } from './ingredient-accessors';
import {
  computeMacroBaseMap,
  type RawNutritionAdjustment,
  reconcileNutritionIds,
  resolveStreamingMealItem,
} from './nutrition';
import type { AnalyzeMealTraceContext } from './orchestrator';
import { nutritionAdjustmentSchema } from './schemas';
import { withStageLog } from './stage-instrumentation';
import { buildLlmStageTrace } from './telemetry/trace';
import {
  classifyAnomalies,
  THRESHOLDS,
  type ValidationAnomaly,
} from './validation';

type MatchIngredientsResult = Awaited<ReturnType<typeof matchIngredients>>;

export interface NutritionStageResult {
  nutritionResult: NutritionAdjustment;
  nutritionMs: number;
  retryStep2Count: number;
  selectedNutritionModel: string;
  nutritionEscalated: boolean;
  nutritionExtractAccumMs: number;
  nutritionChunkCount: number;
}

/**
 * Stage 3: LLM nutrition estimation — streaming with per-item boundary
 * detection, server-anchored macro base map, one anomaly-driven retry with
 * optional model escalation, and the post-stream flush of unemitted items.
 * Emits `stage` and `item_macros` events.
 */
export async function runNutritionStage(args: {
  decomposition: MealDecompositionWithIds;
  matchResult: MatchIngredientsResult;
  allIngredients: MealDecompositionWithIds['mealItems'][number]['ingredients'];
  userContext: UserContext;
  db: AppDb;
  gemini: GeminiClient;
  emit: (event: StreamEvent) => void;
  traceContext: AnalyzeMealTraceContext | undefined;
  budget: PipelineBudget;
  modelProfileForRun: ModelProfile;
}): Promise<NutritionStageResult> {
  const {
    decomposition,
    matchResult,
    allIngredients,
    userContext,
    db,
    gemini,
    emit,
    traceContext,
    budget,
    modelProfileForRun,
  } = args;

  const baseComputeFacts: MealFactsForComputePolicy = {
    ingredientCount: allIngredients.length,
    matchedCount: matchResult.matched.length,
    unmatchedCount: matchResult.unmatched.length,
    anomalyTypes: [],
    parseRetryCount: 0,
    candidateConfidenceSummary: summarizeCandidateConfidence(
      matchResult.matched.map((m) => ({ matchConfidence: m.similarity }))
    ),
  };
  assertMealFactsShape(baseComputeFacts);
  let computePolicy = pickComputePolicy(baseComputeFacts, modelProfileForRun);
  let selectedNutritionModel = computePolicy.call2Model;

  // Stage 3: LLM nutrition estimation (streaming with per-item boundary detection)
  emit({ type: 'stage', stage: 'estimating' });
  const t2 = Date.now();
  let lastExtractedCount = 0;
  let retryStep2Count = 0;

  // Build a lookup from meal item name → total grams for computeStreamingMealItem
  const mealItemGrams = new Map<string, number>();
  for (const mi of decomposition.mealItems) {
    const totalGrams = mi.ingredients.reduce(
      (sum, ing) => sum + decompositionIngredientGrams(ing),
      0
    );
    mealItemGrams.set(mi.name, totalGrams);
  }

  // Server-side macro base map (per ingredientId). Passed to the nutrition
  // prompt builder so the LLM sees `<base ... />` per matched ingredient,
  // and to the streaming/reconcile path so `mid = base` and
  // `low/high = base × factor`. LLM never multiplies — this is what closes
  // the per-100g-echo loophole that produced 5511 kcal sườn non etc.
  const macroBaseMap = computeMacroBaseMap(decomposition, matchResult.matched);
  const decomposedItemByName = new Map<
    string,
    (typeof decomposition.mealItems)[number]
  >();
  for (const mi of decomposition.mealItems) {
    if (!decomposedItemByName.has(mi.name)) {
      decomposedItemByName.set(mi.name, mi);
    }
  }

  // Per-name ordered queue of mealItemIds (§0.1). Two `cơm trắng` dishes
  // have distinct ids; the nutrition stream encounters them in the same
  // order as decomposition, so a FIFO peel-off correctly attributes each
  // streaming macros event to the right logical slot.
  const mealItemIdQueueByName = new Map<string, string[]>();
  const nutritionFallbackIds = createCompactIdSequence();
  const allMealItemIds = new Set<string>();
  for (const mi of decomposition.mealItems) {
    const list = mealItemIdQueueByName.get(mi.name) ?? [];
    list.push(mi.mealItemId);
    mealItemIdQueueByName.set(mi.name, list);
    allMealItemIds.add(mi.mealItemId);
  }
  const macroEmittedCounts = new Map<string, number>();
  const resolveMealItemId = (name: string): string => {
    const ids =
      mealItemIdQueueByName.get(name) ??
      mealItemIdQueueByName.get(capitalizeFirst(name)) ??
      [];
    const idx = macroEmittedCounts.get(name) ?? 0;
    macroEmittedCounts.set(name, idx + 1);
    // Wrap on retry: nutrition retry re-emits the same items, so cycle
    // through the per-name queue rather than running off the end.
    return (
      ids[idx % Math.max(ids.length, 1)] ??
      nutritionFallbackIds.nextMealItemId(allMealItemIds)
    );
  };

  let nutritionExtractAccumMs = 0;
  let nutritionChunkCount = 0;
  const nutritionOnChunk = (accumulated: string) => {
    const t0 = performance.now();
    const { items, newCount } = extractCompletedMealItemNutrition(
      accumulated,
      lastExtractedCount
    );
    nutritionExtractAccumMs += performance.now() - t0;
    nutritionChunkCount += 1;
    lastExtractedCount = newCount;

    for (const rawItemNutrition of items) {
      const quantity =
        mealItemGrams.get(rawItemNutrition.mealItemName) ??
        mealItemGrams.get(capitalizeFirst(rawItemNutrition.mealItemName)) ??
        0;
      // Streaming preview: resolve raw triples against the server-computed
      // base map so the SSE event matches the final shape. The authoritative
      // reconcile pass runs after the full stream completes (below).
      const decomposedMi =
        decomposedItemByName.get(rawItemNutrition.mealItemName) ??
        decomposedItemByName.get(
          capitalizeFirst(rawItemNutrition.mealItemName)
        );
      const itemNutrition = resolveStreamingMealItem(
        rawItemNutrition,
        decomposedMi,
        macroBaseMap
      );
      const streamItem = computeStreamingMealItem(
        itemNutrition,
        quantity,
        lastExtractedCount - items.length + items.indexOf(rawItemNutrition),
        userContext.goal,
        userContext.aggression
      );
      const mealItemId = resolveMealItemId(rawItemNutrition.mealItemName);
      emit({ type: 'item_macros', mealItemId, item: streamItem });
    }
  };

  const nutritionResult: NutritionAdjustment = await withStageLog(
    traceContext,
    'nutrition',
    3,
    { mealItemCount: decomposition.mealItems.length },
    async ({ stageLogId }) => {
      const nutritionPromptBuilder = getNutritionPromptBuilder();
      const systemPrompt = nutritionPromptBuilder(
        decomposition.mealItems,
        matchResult.matched,
        matchResult.unmatched,
        userContext,
        macroBaseMap
      );
      const callTrace = buildLlmStageTrace({
        trace: traceContext,
        stageLogId,
        name: 'nutrition',
        builder: nutritionPromptBuilder as (...a: unknown[]) => string,
        templateSample: systemPrompt,
        model: selectedNutritionModel,
      });

      let rawNutrition: RawNutritionAdjustment = await fetchWithTimeout(
        (signal) =>
          gemini.generateStructuredOutputStream(
            {
              schema: nutritionAdjustmentSchema,
              systemPrompt,
              userMessage:
                'Produce bounded nutrition estimates for each ingredient in each meal item based on the reference data provided.',
              model: selectedNutritionModel,
              temperature: 0.5,
              topP: 1,
              topK: 1,
              abortSignal: signal,
            },
            {
              onAttemptStart: () => {
                lastExtractedCount = 0;
              },
              onAttemptComplete: createBudgetAttemptRecorder({
                db,
                requestId: budget.requestId ?? null,
                workKind: budget.workKind,
                model: selectedNutritionModel,
                providerErrorState: budget.providerErrorState,
              }),
              onChunk: nutritionOnChunk,
              trace: callTrace,
            }
          ),
        NUTRITION_TIMEOUT_MS,
        'nutrition'
      );

      // Reconcile raw LLM triples → server-anchored bounded estimates that
      // every downstream consumer (validation, assembly, streaming flush)
      // expects.
      let reconciledNutrition = reconcileNutritionIds(
        rawNutrition,
        decomposition,
        matchResult.matched
      );

      // Early anomaly check on the resolved bounded triple. 0-kcal is
      // essentially impossible for matched ingredients (P/C are server-anchored
      // and kcal is derived from the macro identity). It can still happen if
      // every ingredient is unmatched AND the LLM emits all-zero macros —
      // that's the only genuine error path we want to retry on.
      const totalMidKcal = reconciledNutrition.mealItems.reduce(
        (sum, mi) =>
          sum +
          mi.ingredients.reduce(
            (s, ing) => s + (ing.caloriesKcal?.mid ?? 0),
            0
          ),
        0
      );
      const earlyAnomalies: ValidationAnomaly[] = [];
      if (totalMidKcal < THRESHOLDS.MIN_TOTAL_KCAL) {
        earlyAnomalies.push({
          type: 'total_calories',
          message:
            totalMidKcal === 0
              ? 'Total 0 kcal — likely LLM failure'
              : `Total ${totalMidKcal.toFixed(0)} kcal < ${THRESHOLDS.MIN_TOTAL_KCAL} — suspiciously low`,
          severity: totalMidKcal === 0 ? 'error' : 'warning',
        });
      }

      const decision = classifyAnomalies(earlyAnomalies);
      if (decision === 'retry_step2') {
        console.warn(
          '[pipeline] classifyAnomalies → retry_step2, retrying Call 2'
        );
        retryStep2Count += 1;
        computePolicy = pickComputePolicy(
          {
            ...baseComputeFacts,
            anomalyTypes: earlyAnomalies.map((a) => a.type),
            parseRetryCount: retryStep2Count,
          },
          modelProfileForRun
        );
        selectedNutritionModel =
          computePolicy.escalateOnRetry &&
          modelProfileForRun.escalationModel !== null
            ? modelProfileForRun.escalationModel
            : computePolicy.call2Model;
        // Reset streaming state so retry re-emits from scratch
        lastExtractedCount = 0;
        macroEmittedCounts.clear();
        rawNutrition = await fetchWithTimeout(
          (signal) =>
            gemini.generateStructuredOutputStream(
              {
                schema: nutritionAdjustmentSchema,
                systemPrompt,
                userMessage:
                  'The previous result had 0 calories. Please recalculate bounded nutrition estimates carefully.',
                model: selectedNutritionModel,
                temperature: 0.5,
                topP: 1,
                topK: 1,
                abortSignal: signal,
              },
              {
                onAttemptStart: () => {
                  lastExtractedCount = 0;
                },
                onAttemptComplete: createBudgetAttemptRecorder({
                  db,
                  requestId: budget.requestId ?? null,
                  workKind: budget.workKind,
                  model: selectedNutritionModel,
                  providerErrorState: budget.providerErrorState,
                }),
                onChunk: nutritionOnChunk,
                trace: callTrace,
              }
            ),
          NUTRITION_TIMEOUT_MS,
          'nutrition-retry'
        );
        reconciledNutrition = reconcileNutritionIds(
          rawNutrition,
          decomposition,
          matchResult.matched
        );
      }

      return reconciledNutrition;
    }
  );

  // Flush remaining meal items not emitted during streaming (always includes the last item)
  if (nutritionResult.mealItems.length > lastExtractedCount) {
    for (
      let i = lastExtractedCount;
      i < nutritionResult.mealItems.length;
      i++
    ) {
      const itemNutrition = nutritionResult.mealItems[i];
      const quantity =
        mealItemGrams.get(itemNutrition.mealItemName) ??
        mealItemGrams.get(capitalizeFirst(itemNutrition.mealItemName)) ??
        0;
      const streamItem = computeStreamingMealItem(
        itemNutrition,
        quantity,
        i,
        userContext.goal,
        userContext.aggression
      );
      const mealItemId =
        itemNutrition.mealItemId ??
        resolveMealItemId(itemNutrition.mealItemName);
      emit({ type: 'item_macros', mealItemId, item: streamItem });
    }
  }
  const nutritionMs = Date.now() - t2;

  return {
    nutritionResult,
    nutritionMs,
    retryStep2Count,
    selectedNutritionModel,
    nutritionEscalated:
      modelProfileForRun.escalationModel !== null &&
      selectedNutritionModel === modelProfileForRun.escalationModel,
    nutritionExtractAccumMs,
    nutritionChunkCount,
  };
}
