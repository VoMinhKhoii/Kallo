/**
 * v2 completeness gate — decides whether an analyzed meal may persist or must
 * surface a retryable partial-failure error instead.
 *
 * There is NO portion ask-back any more. An ingredient whose portion looked
 * shaky ships on its best estimate and the user corrects it with the visual
 * portion picker; the plausibility trail survives as telemetry in
 * `pipeline_stage_logs.output_json`.
 *
 * Two cases remain, both failures rather than questions:
 *   1. a Call-2 chunk that failed after retries — infrastructure;
 *   2. a MATERIAL carve-out — an ingredient the bridge withheld for want of any
 *      macro source, where the withholding meaningfully under-counts the meal.
 */

import type { PipelineUnresolved } from '@/lib/ai/types';
import type { CarvedOutIngredient } from './output';
import { isCarbStapleName } from './plausibility/food-classes';

/**
 * Is this carve-out worth failing the whole analysis over?
 *
 * Materiality, not mere presence. Gating on ANY carve-out meant one garnish the
 * LLM forgot to estimate ("hành lá" among five surviving ingredients) threw
 * away a 99%-correct meal and made the user re-shoot it — a worse outcome than
 * shipping the garnish at zero. Two shapes ARE material:
 *
 *   (a) the meal item lost every one of its ACTIVE ingredients (an explicit
 *       user zero is not one — it never enters the carve-out list, so counting
 *       it would put the threshold out of reach) — this is the mì-gói
 *       incident shape, where a whole 0g/0kcal "Mì gói" row persisted beside a
 *       healthy "Sữa tươi" row and booked the day at 152 kcal;
 *   (b) the carved-out ingredient is a carb staple — rice/noodles/bread carry
 *       the bulk of a Vietnamese meal's calories, so dropping one silently
 *       halves the total no matter how many siblings survive.
 *
 * Everything else ships; the withheld ingredient persists at zero and the full
 * carve-out list stays in telemetry regardless of what this returns.
 */
function isMaterialCarveOut(
  carveOut: CarvedOutIngredient,
  carvedCountByMealItemIdx: Map<number, number>
): boolean {
  const carvedFromItem =
    carvedCountByMealItemIdx.get(carveOut.mealItemIdx) ?? 0;
  return (
    carvedFromItem >= carveOut.activeIngredientCount ||
    isCarbStapleName(carveOut.ingredientName)
  );
}

/**
 * Decide whether the analysis may persist.
 *
 * Both inputs are checked INDEPENDENTLY of the route's meal-level
 * `empty_nutrition` gate, which asks `meal.items.some(item => item.macros
 * .calories !== 0 || ...)`. That predicate is satisfied by any single healthy
 * item, so a meal where one item was fully withheld sailed through it: "1 tô
 * mì gói + sữa" persisted a 0g / 0 kcal "Mì gói" row beside a 152 kcal "Sữa
 * tươi" row and booked the day at 152 kcal. Per-ingredient carve-outs have to
 * be their own signal — a whole-meal predicate cannot see them.
 *
 * Only MATERIAL carve-outs gate — see `isMaterialCarveOut`. An immaterial one
 * ships with the withheld ingredient at zero.
 *
 * Chunk failure ranks first: it is transient and genuinely worth retrying,
 * whereas a carve-out usually needs the input reworded.
 *
 * Returns `undefined` when nothing failed.
 */
export function resolveCompletenessGate(args: {
  failedMealItemNames: string[];
  /** From `V2BridgeOutput.carvedOut` — already excludes `explicit_zero`. */
  carvedOut?: CarvedOutIngredient[];
}): PipelineUnresolved | undefined {
  if (args.failedMealItemNames.length > 0) {
    return {
      mealItemName: args.failedMealItemNames[0],
      ingredientName: args.failedMealItemNames[0],
      reason: 'processing_incomplete',
      unresolvedCount: args.failedMealItemNames.length,
    };
  }

  const carvedOut = args.carvedOut ?? [];
  const carvedCountByMealItemIdx = new Map<number, number>();
  for (const c of carvedOut) {
    carvedCountByMealItemIdx.set(
      c.mealItemIdx,
      (carvedCountByMealItemIdx.get(c.mealItemIdx) ?? 0) + 1
    );
  }
  const material = carvedOut.filter((c) =>
    isMaterialCarveOut(c, carvedCountByMealItemIdx)
  );

  if (material.length > 0) {
    return {
      mealItemName: material[0].mealItemName,
      ingredientName: material[0].ingredientName,
      reason: 'no_macro_data',
      unresolvedCount: material.length,
      carvedOutNames: material.map((c) => c.ingredientName),
    };
  }

  return undefined;
}
