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

import type {
  DecomposedDishV2,
  DecomposedIngredientV2,
  MealDecompositionV2,
} from '@/lib/ai/pipeline/contracts/schemas/decomposition-v2';
import type {
  GroundedEstimation,
  GroundedIngredientEstimate,
} from '@/lib/ai/pipeline/contracts/schemas/grounded-estimation';
import type {
  DecomposedIngredient,
  DecomposedMealItem,
} from '@/lib/ai/types/decomposition';
import type { MatchedIngredient } from '@/lib/ai/types/matching';
import type { BoundedEstimate } from '@/lib/ai/types/nutrition-values';
import { NUTRITION_KEYS } from '@/lib/ai/types/nutrition-values';
import type { VerdictPerIngredient } from './output';

export const ZERO_TRIPLE: BoundedEstimate = { low: 0, mid: 0, high: 0 };

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

export function indexGrounded(
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

export function findGroundedFor(
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
  // FIFO exhaustion: return null rather than clamping to the last
  // occurrence — clamping would silently mis-attach macros/verdicts to a
  // duplicate slot when Call 2 emits fewer occurrences than decomposition.
  if (consumed >= mealOccurrences.length) return null;
  const ingredients = mealOccurrences[consumed];
  // Find the first un-consumed ingredient with the matching name
  // (case-insensitive). The occurrence index belongs in the key: each
  // occurrence of a repeated dish walks its OWN ingredient list, so sharing one
  // counter across them exhausted the second occurrence's single-entry list and
  // returned null — "1 chén cơm … 1 chén cơm" lost the second bowl's estimate.
  const ingQueueKey = `${mealKey}#${consumed}::${ingKeyNorm}`;
  const ingConsumed = ingredientQueueConsumed.get(ingQueueKey) ?? 0;
  const candidates = ingredients.filter(
    (i) => nameKey(i.ingredientName) === ingKeyNorm
  );
  if (candidates.length === 0) return null;
  if (ingConsumed >= candidates.length) return null;
  const pick = candidates[ingConsumed];
  ingredientQueueConsumed.set(ingQueueKey, ingConsumed + 1);
  return pick;
}

/**
 * Pair each v2 ingredient with the LLM's grounded estimate for it. After all
 * ingredients in a meal item have been walked, increment the meal-item
 * occurrence counter (handles duplicate display names).
 */
export function pairIngredientsWithGrounded(
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

export function classifyVerdict(
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
export function v2IngredientToV1(
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

export function v2DishToV1(
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
 * All-zeros nutrition per 100g, derived from `NUTRITION_KEYS` so adding a new
 * nutrient field doesn't need a touch here. Used as a last-resort fallback
 * when a matched candidate somehow has no nutrition row attached (should not
 * happen post-Phase 5 batch fetch; safety net for partial failure modes).
 */
export function buildNullNutrition(): MatchedIngredient['nutritionPer100g'] {
  return Object.fromEntries(
    NUTRITION_KEYS.map((k) => [k, 0])
  ) as unknown as MatchedIngredient['nutritionPer100g'];
}
