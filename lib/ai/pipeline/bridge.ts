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
  BoundedEstimate,
  DecomposedIngredient,
  DecomposedMealItem,
  MatchedIngredient,
  MealDecomposition,
  UnmatchedIngredient,
} from '../types';
import { ensureIdsOnDecomposition, type MealDecompositionWithIds } from './ids';
import type { RawNutritionAdjustment } from './nutrition';
import type {
  DecomposedDishV2,
  DecomposedIngredientV2,
  GroundedEstimation,
  GroundedIngredientEstimate,
  MealDecompositionV2,
} from './schemas';

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

const ZERO_TRIPLE: BoundedEstimate = { low: 0, mid: 0, high: 0 };

/**
 * Index Call 2's mealItems[] + ingredients[] by name for FIFO matching with
 * the v2 decomposition (mirrors v1's reconcileNutritionIds policy).
 */
/**
 * Normalize name comparisons across v2 decomposition and Call 2 output.
 * The orchestrator capitalizes v2 decomposition names before sending to
 * Call 2, but the LLM may echo back with different casing. Use the
 * lowercase form as the canonical lookup key on both sides.
 */
const nameKey = (s: string): string => s.trim().toLocaleLowerCase('vi-VN');

function indexGrounded(
  grounded: GroundedEstimation
): Map<string, Array<GroundedIngredientEstimate[]>> {
  // Outer key: lowercased meal item name (so casing drift between
  // decomposition and Call 2 output doesn't break the lookup).
  const map = new Map<string, GroundedIngredientEstimate[][]>();
  for (const mi of grounded.mealItems) {
    const k = nameKey(mi.mealItemName);
    const list = map.get(k) ?? [];
    list.push(mi.ingredients);
    map.set(k, list);
  }
  return map;
}

function findGroundedFor(
  mealItemName: string,
  ingredientName: string,
  mealItemQueueConsumed: Map<string, number>,
  ingredientQueueConsumed: Map<string, number>,
  index: Map<string, GroundedIngredientEstimate[][]>
): GroundedIngredientEstimate | null {
  const mealKey = nameKey(mealItemName);
  const ingKeyNorm = nameKey(ingredientName);
  const mealOccurrences = index.get(mealKey);
  if (!mealOccurrences || mealOccurrences.length === 0) return null;
  const consumed = mealItemQueueConsumed.get(mealKey) ?? 0;
  const ingredients =
    mealOccurrences[Math.min(consumed, mealOccurrences.length - 1)];
  // Find the first un-consumed ingredient with the matching name (case-insensitive).
  const ingQueueKey = `${mealKey}::${ingKeyNorm}`;
  const ingConsumed = ingredientQueueConsumed.get(ingQueueKey) ?? 0;
  const candidates = ingredients.filter(
    (i) => nameKey(i.ingredientName) === ingKeyNorm
  );
  if (candidates.length === 0) return null;
  const pick = candidates[Math.min(ingConsumed, candidates.length - 1)];
  ingredientQueueConsumed.set(ingQueueKey, ingConsumed + 1);
  return pick;
}

/**
 * Pair each v2 ingredient with the LLM's grounded estimate for it. After all
 * ingredients in a meal item have been walked, increment the meal-item
 * occurrence counter (handles duplicate display names).
 */
function pairIngredientsWithGrounded(
  v2: MealDecompositionV2,
  grounded: GroundedEstimation
): Array<{
  mealItemIdx: number;
  mealItemName: string;
  ingredientIdx: number;
  ingredient: DecomposedIngredientV2;
  cookingMethodForIng: string;
  dishCookingMethod: string;
  ground: GroundedIngredientEstimate | null;
}> {
  const grIndex = indexGrounded(grounded);
  const mealItemConsumed = new Map<string, number>();
  const ingredientConsumed = new Map<string, number>();
  const out: ReturnType<typeof pairIngredientsWithGrounded> = [];

  v2.mealItems.forEach((mi, mealItemIdx) => {
    mi.ingredients.forEach((ing, ingredientIdx) => {
      const ground = findGroundedFor(
        mi.name,
        ing.rawName,
        mealItemConsumed,
        ingredientConsumed,
        grIndex
      );
      out.push({
        mealItemIdx,
        mealItemName: mi.name,
        ingredientIdx,
        ingredient: ing,
        cookingMethodForIng: ing.cookingMethod ?? mi.cookingMethod,
        dishCookingMethod: mi.cookingMethod,
        ground,
      });
    });
    // Advance meal-item-name FIFO so duplicates pick the next occurrence.
    // Key by lowercased name so findGroundedFor's lookup hits the same slot.
    const miKey = nameKey(mi.name);
    const consumed = mealItemConsumed.get(miKey) ?? 0;
    mealItemConsumed.set(miKey, consumed + 1);
  });

  return out;
}

function classifyVerdict(
  ground: GroundedIngredientEstimate | null,
  numCandidates: number
): {
  verdict: VerdictPerIngredient['verdict'];
  selectedCandidateIdx: number | null;
  rejectReason: string | null;
} {
  if (!ground) {
    return {
      verdict: 'missing',
      selectedCandidateIdx: null,
      rejectReason: null,
    };
  }
  const selected = ground.selectedCandidateId;
  if (selected === undefined) {
    // No verdict emitted — only valid when there were no candidates.
    if (numCandidates === 0) {
      return {
        verdict: 'unmatched',
        selectedCandidateIdx: null,
        rejectReason: null,
      };
    }
    return {
      verdict: 'rejected',
      selectedCandidateIdx: null,
      rejectReason: 'no verdict emitted despite candidates',
    };
  }
  if (selected === 'none') {
    return {
      verdict: 'rejected',
      selectedCandidateIdx: null,
      rejectReason: ground.rejectReason ?? null,
    };
  }
  // Selected candidate id is "c1", "c2", … — map back to index.
  const match = /^c(\d+)$/.exec(selected);
  if (!match) {
    return {
      verdict: 'rejected',
      selectedCandidateIdx: null,
      rejectReason: `unrecognized selectedCandidateId="${selected}"`,
    };
  }
  const idx = Number.parseInt(match[1], 10) - 1;
  if (idx < 0 || idx >= numCandidates) {
    return {
      verdict: 'rejected',
      selectedCandidateIdx: null,
      rejectReason: `selectedCandidateId="${selected}" out of range (candidates=${numCandidates})`,
    };
  }
  return {
    verdict: 'accepted',
    selectedCandidateIdx: idx,
    rejectReason: null,
  };
}

/**
 * Build the v1-shape `DecomposedIngredient` for a v2 ingredient. Carries
 * over `prepNotes` so the existing prep-notes-aware guard band fires; sets
 * `weightBasis: 'raw'` for raw/unknown candidates so `computeDbScalingGrams`
 * returns grams unchanged (eliminates the yield-factor fudge for v2).
 */
function v2IngredientToV1(
  v2: DecomposedIngredientV2,
  cookingMethodForIng: string,
  grams: number,
  weightBasis: 'raw' | undefined
): DecomposedIngredient {
  return {
    rawName: v2.rawName,
    canonicalName: v2.canonicalName,
    grams,
    cookingMethod: cookingMethodForIng,
    prepNotes: v2.prepNotes,
    ...(weightBasis ? { weightBasis } : {}),
  };
}

function v2DishToV1(
  v2: DecomposedDishV2,
  ingredients: DecomposedIngredient[]
): DecomposedMealItem {
  return {
    name: v2.name,
    cookingMethod: v2.cookingMethod,
    cuisineNote: v2.cuisineNote,
    ingredients,
  };
}

/**
 * The fallback grams to use when Call 2 didn't return a value for this
 * ingredient (verdict='missing'). 1g lets downstream code treat it as a
 * tiny placeholder rather than dividing by zero. Anomaly detection in v1
 * will catch implausible_grams.
 */
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
