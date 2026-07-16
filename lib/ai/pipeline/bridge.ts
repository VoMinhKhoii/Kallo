/**
 * V2 → V1 adapter.
 *
 * The v2 path produces (a) a slimmed decomposition, (b) top-K candidates per
 * ingredient, and (c) a grounded estimation with verdict + grams + macros.
 * The existing v1 nutrition resolution + assembly + validation infrastructure
 * is rich (server-anchored P/C, prep-notes bands, kcal-from-identity, density
 * clamp, anomaly detection, goal adjustment, multi-meal aggregation). Rather
 * than fork that infrastructure, this module synthesizes the v1-shaped
 * inputs from v2 outputs so v1 assembly runs unchanged.
 *
 * Key translation rule:
 *   - Call 2 emits grams scoped to the selected candidate's db_state. The
 *     server must scale DB per_100g × grams / 100 with NO convertCookedToRaw
 *     fudge. We achieve this by synthesizing the v1 ingredient with
 *     `weightBasis: 'raw'` whenever the selected candidate's state is 'raw'
 *     (or 'unknown'). For cooked candidates, `weightBasis` is omitted and
 *     computeDbScalingGrams's cooked-state path also returns grams unchanged.
 *     Net effect: the yield-factor table is bypassed for every v2 ingredient.
 */

import { NUTRITION_KEYS } from '../constants';
import type { IngredientV2MatchResult } from '../matching/top-k-cascade';
import type {
  DecomposedIngredient,
  DecomposedMealItem,
  MatchedIngredient,
  MealDecomposition,
  UnmatchedIngredient,
} from '../types';
import {
  classifyVerdict,
  pairIngredientsWithGrounded,
  v2DishToV1,
  v2IngredientToV1,
  ZERO_TRIPLE,
} from './bridge-verdicts';
import { ensureIdsOnDecomposition, type MealDecompositionWithIds } from './ids';
import type { RawNutritionAdjustment } from './nutrition';
import type {
  GroundedEstimation,
  GroundedIngredientEstimate,
  MealDecompositionV2,
} from './schemas-v2';

export interface VerdictPerIngredient {
  /** Position in the original decomposition (meal-item, ingredient) tuple. */
  mealItemIdx: number;
  ingredientIdx: number;
  /** What the LLM decided. */
  verdict: 'accepted' | 'rejected' | 'unmatched' | 'missing';
  /** Selected candidate index inside the ingredient's candidate list when accepted. */
  selectedCandidateIdx: number | null;
  /** Set on rejected verdicts; passed through to telemetry. */
  rejectReason: string | null;
  /** Reference to the v2 grounded output (null when missing). */
  grounded: GroundedIngredientEstimate | null;
}

export interface V2BridgeOutput {
  /** v1-shape decomposition with run-scoped IDs and grams emitted by Call 2. */
  decomposition: MealDecompositionWithIds;
  /** Matched ingredients with DB-anchored per_100g and run-scoped IDs. */
  matched: MatchedIngredient[];
  /** Unmatched ingredients (no candidates OR verdict=rejected). */
  unmatched: UnmatchedIngredient[];
  /** v1-shape RawNutritionAdjustment built from Call 2 macros. */
  rawNutrition: RawNutritionAdjustment;
  /** Per-ingredient verdict trail for telemetry / shadow-divergence dashboards. */
  verdicts: VerdictPerIngredient[];
}

const FALLBACK_GRAMS = 1;

export function bridgeV2ToV1(args: {
  v2: MealDecompositionV2;
  matches: IngredientV2MatchResult[];
  grounded: GroundedEstimation;
  mealContext: string;
  /**
   * Optional pre-minted meal-item IDs from the Call 1 streaming controller
   * (`createDecompositionStreamController.getStreamedMealItemIds()`). Keyed
   * by `${displayName}::${occurrence}` (1-based occurrence). When provided,
   * `ensureIdsOnDecomposition` preserves these IDs so the streamed
   * `item_name` and `item_macros` events reference the same IDs as the
   * final `result` event.
   */
  preMintedMealItemIds?: Map<string, string>;
}): V2BridgeOutput {
  const { v2, matches, grounded, mealContext, preMintedMealItemIds } = args;

  const paired = pairIngredientsWithGrounded(v2, grounded);
  const matchByIndex = new Map<number, IngredientV2MatchResult>();
  for (const m of matches) matchByIndex.set(m.ingredientIndex, m);

  const verdicts: VerdictPerIngredient[] = [];
  const v1MealItems: DecomposedMealItem[] = [];
  // Per-flat-index partial matched data (without ingredientId yet — populated
  // after ensureIdsOnDecomposition assigns run-scoped ids).
  const matchedPartialByFlatIdx = new Map<
    number,
    Omit<MatchedIngredient, 'ingredientId'>
  >();
  const unmatched: UnmatchedIngredient[] = [];
  const rawMealItems: RawNutritionAdjustment['mealItems'] = [];

  let flatIngredientIdx = 0;

  v2.mealItems.forEach((mi, mealItemIdx) => {
    const v1Ings: DecomposedIngredient[] = [];
    const rawIngs: RawNutritionAdjustment['mealItems'][number]['ingredients'] =
      [];

    mi.ingredients.forEach((ing, ingredientIdx) => {
      const pair = paired.find(
        (p) =>
          p.mealItemIdx === mealItemIdx && p.ingredientIdx === ingredientIdx
      );
      const matchResult = matchByIndex.get(flatIngredientIdx);
      const candidates = matchResult?.candidates ?? [];
      const ground = pair?.ground ?? null;
      const { verdict, selectedCandidateIdx, rejectReason } = classifyVerdict(
        ground,
        candidates.length
      );
      verdicts.push({
        mealItemIdx,
        ingredientIdx,
        verdict,
        selectedCandidateIdx,
        rejectReason,
        grounded: ground,
      });

      const cookingMethodForIng = ing.cookingMethod ?? mi.cookingMethod;
      const grams =
        ground?.grams && ground.grams > 0 ? ground.grams : FALLBACK_GRAMS;
      let weightBasis: 'raw' | undefined;
      let v1Ing: DecomposedIngredient;

      if (verdict === 'accepted' && selectedCandidateIdx !== null) {
        const candidate = candidates[selectedCandidateIdx];
        const dbState = candidate.info.state;
        // For raw or unknown candidates, force weightBasis='raw' so
        // computeDbScalingGrams skips convertCookedToRaw. For cooked
        // candidates, omitting weightBasis still yields grams unchanged
        // (computeDbScalingGrams's cooked-state path returns input grams).
        if (dbState === 'raw' || dbState === 'unknown') weightBasis = 'raw';
        v1Ing = v2IngredientToV1(ing, cookingMethodForIng, grams, weightBasis);
        matchedPartialByFlatIdx.set(flatIngredientIdx, {
          ingredientName: ing.rawName,
          foodCompositionId: candidate.info.foodCompositionId,
          matchedName: candidate.info.matchedName,
          similarity: candidate.info.similarity,
          confidence: candidate.info.confidence,
          dbState: dbState,
          matchType: candidate.info.matchType,
          source: candidate.info.source,
          nutritionPer100g: candidate.nutrition ?? buildNullNutrition(),
        });
      } else {
        // Unmatched OR rejected: Call 2 macros flow through verbatim.
        v1Ing = v2IngredientToV1(ing, cookingMethodForIng, grams, undefined);
        unmatched.push({
          ingredientName: ing.rawName,
          mealContext: rejectReason
            ? `${mealContext} (rejected: ${rejectReason})`
            : mealContext,
        });
      }

      v1Ings.push(v1Ing);
      rawIngs.push({
        ingredientName: ing.rawName,
        caloriesKcal: ground?.caloriesKcal ?? ZERO_TRIPLE,
        proteinG: ground?.proteinG ?? ZERO_TRIPLE,
        carbohydrateG: ground?.carbohydrateG ?? ZERO_TRIPLE,
        fatG: ground?.fatG ?? ZERO_TRIPLE,
      });

      flatIngredientIdx++;
    });

    v1MealItems.push(v2DishToV1(mi, v1Ings));
    if (rawIngs.length > 0) {
      rawMealItems.push({ mealItemName: mi.name, ingredients: rawIngs });
    }
  });

  // Apply pre-minted IDs from the Call 1 streaming controller, if any, so
  // streamed `item_name` / `item_macros` events reference the same IDs as
  // the final `result` event. ensureIdsOnDecomposition preserves valid
  // compact IDs; unrecognized or duplicate slots fall through to fresh
  // run-scoped ids.
  if (preMintedMealItemIds && preMintedMealItemIds.size > 0) {
    const occCounts = new Map<string, number>();
    for (const mi of v1MealItems) {
      const name = mi.name;
      const occ = (occCounts.get(name) ?? 0) + 1;
      occCounts.set(name, occ);
      const minted = preMintedMealItemIds.get(`${name}::${occ}`);
      if (minted) mi.mealItemId = minted;
    }
  }

  const v1Decomp: MealDecomposition = {
    isFood: v2.isFood,
    mealSlot: v2.mealSlot,
    mealItems: v1MealItems,
  };
  const withIds = ensureIdsOnDecomposition(v1Decomp);

  // Walk withIds in flat order (same order as flatIngredientIdx above) and
  // attach run-scoped ingredientIds to partial matched data.
  const matched: MatchedIngredient[] = [];
  let cursor = 0;
  withIds.mealItems.forEach((mi) => {
    mi.ingredients.forEach((ing) => {
      const partial = matchedPartialByFlatIdx.get(cursor);
      if (partial) {
        matched.push({ ...partial, ingredientId: ing.ingredientId });
      }
      cursor++;
    });
  });

  const rawNutrition: RawNutritionAdjustment = { mealItems: rawMealItems };

  return {
    decomposition: withIds,
    matched,
    unmatched,
    rawNutrition,
    verdicts,
  };
}

/**
 * All-zeros nutrition per 100g, derived from `NUTRITION_KEYS` so adding a new
 * nutrient field doesn't need a touch here. Used as a last-resort fallback
 * when a matched candidate somehow has no nutrition row attached (should not
 * happen post-Phase 5 batch fetch; safety net for partial failure modes).
 */
function buildNullNutrition(): MatchedIngredient['nutritionPer100g'] {
  return Object.fromEntries(
    NUTRITION_KEYS.map((k) => [k, 0])
  ) as unknown as MatchedIngredient['nutritionPer100g'];
}
