/**
 * V2 orchestrator — pure-decompose Call 1 + CRAG-grounded Call 2.
 *
 * Pipeline:
 *   1. Call 1 (decomposition-v2): LLM emits ingredient names + state/prep
 *      hints. NO grams.
 *   2. Match: top-K candidates per ingredient via v2-cascade.
 *   3. Call 2 (grounded-estimation): LLM picks a candidate (CRAG verdict),
 *      emits grams scoped to the selected candidate's state, and bounded
 *      macros.
 *   4. Bridge: v2 outputs → v1-shape inputs.
 *   5. Resolve macros + assemble result via existing v1 infrastructure.
 *
 * Deliberately minimal in this chunk:
 *   - No streaming (returns full PipelineResponse; SSE preserved at the v1
 *     dispatch layer where Call 1 streaming was wired).
 *   - No L4 decomposition cache (v1 cache key includes the v1 schema hash;
 *     v2 cache lives in a follow-up).
 *   - No anomaly retry, no language guard (both can be layered on later).
 *   - No shadow runner (shadow-runner.ts compares two v1 calls; v2-shadow
 *     comparison is a separate file).
 */
import type { AppDb } from '@/lib/db';
import type { GeminiClient } from '../gemini';
import {
  type IngredientV2MatchResult,
  matchTopKPerIngredient,
} from '../matching/v2-cascade';
import { buildDecompositionV2Prompt } from '../prompts/decomposition-v2';
import {
  buildGroundedEstimationPrompt,
  type MealItemWithCandidates,
} from '../prompts/grounded-estimation';
import type { PromptPersonalizationContext } from '../prompts/types';
import type { StreamEvent } from '../streaming/types';
import type { PipelineResponse, UserContext } from '../types';
import { assembleResult } from './assembly';
import { handleError, nonFoodResponse } from './errors';
import { resolveModelProfile } from './model-profile';
import { reconcileNutritionIds } from './nutrition';
import {
  type GroundedEstimation,
  groundedEstimationSchema,
  type MealDecompositionV2,
  mealDecompositionV2Schema,
} from './schemas';
import { bridgeV2ToV1 } from './v2-bridge';

export interface AnalyzeMealV2Options {
  /** Top-K candidates to pass to Call 2 per ingredient. Default 3. */
  topK?: number;
  /** Concurrency for embedding + matching fan-out. Default 4. */
  matchConcurrency?: number;
  /** Optional Call 2 temperature (default 0.4 — slightly lower than v1's 0.5 because Call 2 in v2 also owns grams). */
  call2Temperature?: number;
}

/**
 * Run the v2 pipeline end-to-end. Mirrors `analyzeMeal` from v1 in signature
 * (minus `traceContext` / `options.shadow` which are v1-shadow-specific) so
 * the dispatch at v1's analyzeMeal can swap implementations behind the
 * feature flag.
 */
export async function analyzeMealV2(
  rawInput: string,
  userContext: UserContext,
  db: AppDb,
  gemini: GeminiClient,
  onEvent?: (event: StreamEvent) => void,
  options: AnalyzeMealV2Options = {}
): Promise<PipelineResponse> {
  const emit = onEvent ?? (() => {});
  const topK = options.topK ?? 3;
  const matchConcurrency = options.matchConcurrency ?? 4;
  const call2Temperature = options.call2Temperature ?? 0.4;
  const profile = resolveModelProfile();
  const promptCtx = toPromptPersonalizationContext(userContext);

  try {
    // ---- Stage 1: Call 1 — pure decomposition ---------------------------
    emit({ type: 'stage', stage: 'decomposing' });
    const decompSystemPrompt = buildDecompositionV2Prompt(promptCtx);
    const decomposition: MealDecompositionV2 =
      await gemini.generateStructuredOutputStream({
        schema: mealDecompositionV2Schema,
        systemPrompt: decompSystemPrompt,
        userMessage: rawInput,
        model: profile.decompositionModel,
        temperature: 0.3,
        topP: 1,
        topK: 1,
      });

    if (!decomposition.isFood || decomposition.mealItems.length === 0) {
      return nonFoodResponse();
    }

    // ---- Stage 2: Match top-K per ingredient ----------------------------
    emit({ type: 'stage', stage: 'matching' });
    const flatIngredients = decomposition.mealItems.flatMap((mi) =>
      mi.ingredients.map((ing) => ({
        ingredient: ing,
        dishCookingMethod: mi.cookingMethod,
      }))
    );
    const matchResults: IngredientV2MatchResult[] =
      await matchTopKPerIngredient(
        flatIngredients.map((f) => f.ingredient),
        flatIngredients.map((f) => f.dishCookingMethod),
        db,
        gemini,
        { k: topK, concurrency: matchConcurrency }
      );

    // ---- Stage 3: Call 2 — grounded estimation --------------------------
    emit({ type: 'stage', stage: 'estimating' });
    const mealItemsWithCandidates: MealItemWithCandidates[] =
      buildCallTwoPayload(decomposition, matchResults);
    const call2SystemPrompt = buildGroundedEstimationPrompt({
      originalPrompt: rawInput,
      mealItems: mealItemsWithCandidates,
      userContext: promptCtx,
    });
    const grounded: GroundedEstimation =
      await gemini.generateStructuredOutputStream({
        schema: groundedEstimationSchema,
        systemPrompt: call2SystemPrompt,
        userMessage:
          'Verify each candidate (CRAG verdict), estimate grams scoped to the selected candidate state, and emit bounded macros per the rules above.',
        model: profile.nutritionModel,
        temperature: call2Temperature,
        topP: 1,
        topK: 1,
      });

    // ---- Stage 4: Bridge v2 → v1 shapes ---------------------------------
    emit({ type: 'stage', stage: 'assembling' });
    const bridged = bridgeV2ToV1({
      v2: decomposition,
      matches: matchResults,
      grounded,
      mealContext: rawInput,
    });

    // ---- Stage 5: Reconcile macros + assemble ---------------------------
    const reconciled = reconcileNutritionIds(
      bridged.rawNutrition,
      bridged.decomposition,
      bridged.matched
    );
    const assembly = assembleResult(
      bridged.decomposition,
      reconciled,
      bridged.matched,
      bridged.unmatched,
      userContext
    );

    // Note: `result` + `analysis_complete` SSE events are emitted by the
    // /api/analyze-meal route AFTER persistence, not from the orchestrator
    // itself. Same contract as v1.

    // V2-specific telemetry (logged, not yet surfaced through PipelineResponse).
    logV2Telemetry({
      decomposition,
      matchResults,
      grounded,
      verdicts: bridged.verdicts,
    });

    return { success: true, data: assembly.result };
  } catch (error) {
    return handleError(error);
  }
}

/** Build the per-meal-item payload for the grounded-estimation prompt. */
function buildCallTwoPayload(
  decomposition: MealDecompositionV2,
  matchResults: IngredientV2MatchResult[]
): MealItemWithCandidates[] {
  let flatIdx = 0;
  return decomposition.mealItems.map((mi) => ({
    mealItem: mi,
    ingredients: mi.ingredients.map((ing) => {
      const matchResult = matchResults.find(
        (m) => m.ingredientIndex === flatIdx
      );
      flatIdx++;
      const candidates = (matchResult?.candidates ?? []).map((c, i) => ({
        id: `c${i + 1}`,
        similarity: c.info.similarity,
        dbName: c.info.matchedName,
        dbState: c.info.state,
        source: c.info.source ?? ('fao' as const),
        per100gKcal: c.nutrition?.caloriesKcal ?? null,
        per100gProteinG: c.nutrition?.proteinG ?? null,
        per100gCarbohydrateG: c.nutrition?.carbohydrateG ?? null,
        per100gFatG: c.nutrition?.fatG ?? null,
        inediblePct: c.inediblePct,
      }));
      return { ingredient: ing, candidates };
    }),
  }));
}

function toPromptPersonalizationContext(
  userContext: UserContext
): PromptPersonalizationContext {
  return {
    countryOfOrigin: userContext.countryOfOrigin,
    countryOfResidence: userContext.countryOfResidence,
    cookingHabits: userContext.cookingHabits,
    inputLanguage: userContext.inputLanguage,
    outputLanguage: userContext.outputLanguage,
  };
}

interface V2TelemetryInput {
  decomposition: MealDecompositionV2;
  matchResults: IngredientV2MatchResult[];
  grounded: GroundedEstimation;
  verdicts: ReturnType<typeof bridgeV2ToV1>['verdicts'];
}

function logV2Telemetry(input: V2TelemetryInput): void {
  const totalIngredients = input.verdicts.length;
  const accepted = input.verdicts.filter(
    (v) => v.verdict === 'accepted'
  ).length;
  const rejected = input.verdicts.filter(
    (v) => v.verdict === 'rejected'
  ).length;
  const unmatched = input.verdicts.filter(
    (v) => v.verdict === 'unmatched'
  ).length;
  const missing = input.verdicts.filter((v) => v.verdict === 'missing').length;
  const overturnedTopOne = input.verdicts.filter(
    (v) =>
      v.verdict === 'accepted' &&
      v.selectedCandidateIdx !== null &&
      v.selectedCandidateIdx > 0
  ).length;
  console.info('[v2-pipeline] verdicts', {
    totalIngredients,
    accepted,
    rejected,
    unmatched,
    missing,
    overturnedTopOne,
    mealItems: input.decomposition.mealItems.length,
  });
}
