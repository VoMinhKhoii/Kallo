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
import { nameKey } from '@/lib/core/text/name-key';
import { createDishSlots, type DishSlot } from './dish-slots';
import type { VerdictPerIngredient } from './output';

export const ZERO_TRIPLE: BoundedEstimate = { low: 0, mid: 0, high: 0 };

/** Queue key of one ingredient inside its dish slot (see `createDishSlots`). */
const queueKey = (slot: DishSlot, ingredientName: string): string =>
  `${slot.key}#${slot.occ}::${nameKey(ingredientName)}`;

/**
 * One FIFO queue of Call 2 estimates per (dish slot, ingredient name), in
 * output order. A dish Call 2 split into several same-name items pools into
 * its one slot, so every ingredient still finds its estimate (per-item lookup
 * dropped all but the first as `missing`); a repeated dish keeps one slot per
 * occurrence.
 */
function queueGrounded(
  grounded: GroundedEstimation,
  slotOf: (name: string) => DishSlot
): Map<string, GroundedIngredientEstimate[]> {
  const queues = new Map<string, GroundedIngredientEstimate[]>();
  for (const mi of grounded.mealItems) {
    const slot = slotOf(mi.mealItemName);
    for (const ing of mi.ingredients) {
      const k = queueKey(slot, ing.ingredientName);
      const q = queues.get(k) ?? [];
      q.push(ing);
      queues.set(k, q);
    }
  }
  return queues;
}

/**
 * Pair each v2 ingredient with the LLM's grounded estimate for it: the next
 * unconsumed estimate in its (dish slot, ingredient) queue, or null when
 * Call 2 returned none (exhaustion never re-uses an estimate).
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
  const dishNames = v2.mealItems.map((mi) => mi.name);
  const queues = queueGrounded(grounded, createDishSlots(dishNames));
  const decompositionSlotOf = createDishSlots(dishNames);
  const out: ReturnType<typeof pairIngredientsWithGrounded> = [];

  v2.mealItems.forEach((mi, mealItemIdx) => {
    const slot = decompositionSlotOf(mi.name);
    mi.ingredients.forEach((ing, ingredientIdx) => {
      const ground = queues.get(queueKey(slot, ing.rawName))?.shift() ?? null;
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
