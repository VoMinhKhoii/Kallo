/**
 * V2 → V1 adapter.
 *
 * The v2 path produces (a) a slimmed decomposition, (b) top-K candidates per
 * ingredient, and (c) a grounded estimation with verdict + mass + macros.
 * The existing v1 nutrition resolution + assembly + validation infrastructure
 * is rich (server-anchored P/C, prep-notes bands, kcal-from-identity, density
 * clamp, anomaly detection, goal adjustment, multi-meal aggregation). Rather
 * than fork that infrastructure, this module synthesizes the v1-shaped
 * inputs from v2 outputs so v1 assembly runs unchanged.
 *
 * This file owns the WALK: it pairs the decomposition with Call 2's output,
 * runs `resolveIngredient` over every ingredient in flat order, accumulates
 * the per-ingredient results, and attaches the run-scoped ids that only exist
 * once `ensureIdsOnDecomposition` has seen the whole decomposition. The
 * per-ingredient decisions themselves live in `resolve-ingredient.ts`.
 *
 * Key translation rule:
 *   - Legacy Call 2 emits edible grams. REFUSE_PCT_SCHEMA emits grossG plus
 *     refusePct and the server derives edible grams. Either result is scoped
 *     to the selected candidate's db_state and scales DB per_100g with NO
 *     convertCookedToRaw
 *     fudge. We achieve this by synthesizing the v1 ingredient with
 *     `weightBasis: 'raw'` whenever the selected candidate's state is 'raw'
 *     (or 'unknown'). For cooked candidates, `weightBasis` is omitted and
 *     computeDbScalingGrams's cooked-state path also returns grams unchanged.
 *     Net effect: the yield-factor table is bypassed for every v2 ingredient.
 */

import type { IngredientV2MatchResult } from '@/lib/ai/matching/retrieve/top-k-cascade';
import { ensureIdsOnDecomposition } from '@/lib/ai/pipeline/contracts/decomposition-ids';
import type { MealDecompositionV2 } from '@/lib/ai/pipeline/contracts/schemas/decomposition-v2';
import type { GroundedEstimation } from '@/lib/ai/pipeline/contracts/schemas/grounded-estimation';
import type { PortionResolution } from '@/lib/ai/portion/types';
import type {
  DecomposedIngredient,
  MealDecomposition,
} from '@/lib/ai/types/decomposition';
import type {
  MatchedIngredient,
  UnmatchedIngredient,
} from '@/lib/ai/types/matching';
import type { RawNutritionAdjustment } from './macro-resolution';
import type {
  CarvedOutIngredient,
  PlausibilityPerIngredient,
  V2BridgeOutput,
  VerdictPerIngredient,
} from './output';
import { resolveIngredient } from './resolve-ingredient';
import { pairIngredientsWithGrounded, v2DishToV1 } from './verdicts';

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
  /**
   * Phase 3 portion-resolver output, one entry per flat ingredient (same order
   * as the decomposition walk). When a resolution grounded grams (steps 1–4),
   * it OVERRIDES the LLM grams so Call 2 cannot drift from the server anchor.
   * When a resolution is `unresolved`, the ingredient is labelled
   * `unresolved_estimate` in the telemetry trail but still ships on Call 2's
   * grams. Omitted on the v1-shadow / test paths that don't run the resolver.
   */
  portionResolutions?: PortionResolution[];
}): V2BridgeOutput {
  const {
    v2,
    matches,
    grounded,
    mealContext,
    preMintedMealItemIds,
    portionResolutions,
  } = args;

  const paired = pairIngredientsWithGrounded(v2, grounded);
  const matchByIndex = new Map<number, IngredientV2MatchResult>();
  for (const m of matches) matchByIndex.set(m.ingredientIndex, m);

  const verdicts: VerdictPerIngredient[] = [];
  const v1MealItems: MealDecomposition['mealItems'] = [];
  // Per-flat-index partial matched data (without ingredientId yet — populated
  // after ensureIdsOnDecomposition assigns run-scoped ids).
  const matchedPartialByFlatIdx = new Map<
    number,
    Omit<MatchedIngredient, 'ingredientId'>
  >();
  const unmatched: UnmatchedIngredient[] = [];
  // `activeIngredientCount` can only be known once the whole item has been
  // walked (an explicit zero is discovered per ingredient), so the entries are
  // collected without it and the denominator is filled in below.
  const carvedOutPartial: Omit<CarvedOutIngredient, 'activeIngredientCount'>[] =
    [];
  const explicitZerosByMealItemIdx = new Map<number, number>();
  const rawMealItems: RawNutritionAdjustment['mealItems'] = [];
  // Per-flat-index plausibility partial (ingredientId attached after id assignment).
  const plausibilityPartialByFlatIdx = new Map<
    number,
    Omit<PlausibilityPerIngredient, 'ingredientId'>
  >();

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
      const resolved = resolveIngredient({
        ingredient: ing,
        mealItem: mi,
        mealItemIdx,
        ingredientIdx,
        ground: pair?.ground ?? null,
        matchResult: matchByIndex.get(flatIngredientIdx),
        portion: portionResolutions?.[flatIngredientIdx],
        mealContext,
      });

      verdicts.push(resolved.verdict);
      plausibilityPartialByFlatIdx.set(
        flatIngredientIdx,
        resolved.plausibility
      );
      v1Ings.push(resolved.v1Ingredient);
      if (resolved.carveOut?.kind === 'explicit_zero') {
        explicitZerosByMealItemIdx.set(
          mealItemIdx,
          (explicitZerosByMealItemIdx.get(mealItemIdx) ?? 0) + 1
        );
      } else if (resolved.carveOut?.kind === 'withheld') {
        carvedOutPartial.push(resolved.carveOut.entry);
      }
      if (resolved.matched) {
        matchedPartialByFlatIdx.set(flatIngredientIdx, resolved.matched);
      }
      if (resolved.unmatched) unmatched.push(resolved.unmatched);
      if (resolved.rawMacros) rawIngs.push(resolved.rawMacros);

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
  const plausibility: PlausibilityPerIngredient[] = [];
  let cursor = 0;
  withIds.mealItems.forEach((mi) => {
    mi.ingredients.forEach((ing) => {
      const partial = matchedPartialByFlatIdx.get(cursor);
      if (partial) {
        matched.push({ ...partial, ingredientId: ing.ingredientId });
      }
      const plausPartial = plausibilityPartialByFlatIdx.get(cursor);
      if (plausPartial) {
        plausibility.push({
          ...plausPartial,
          ingredientId: ing.ingredientId,
        });
      }
      cursor++;
    });
  });

  const rawNutrition: RawNutritionAdjustment = { mealItems: rawMealItems };

  const carvedOut: CarvedOutIngredient[] = carvedOutPartial.map((c) => ({
    ...c,
    activeIngredientCount:
      v2.mealItems[c.mealItemIdx].ingredients.length -
      (explicitZerosByMealItemIdx.get(c.mealItemIdx) ?? 0),
  }));

  return {
    decomposition: withIds,
    matched,
    unmatched,
    rawNutrition,
    verdicts,
    plausibility,
    carvedOut,
  };
}
