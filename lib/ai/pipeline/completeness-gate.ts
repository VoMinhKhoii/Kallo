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
 *   2. an ingredient the bridge withheld for want of any macro source — the
 *      meal would persist under-counted.
 */

import type { PipelineUnresolved } from '../types';
import type { CarvedOutIngredient } from './bridge-output';

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
  if (carvedOut.length > 0) {
    return {
      mealItemName: carvedOut[0].mealItemName,
      ingredientName: carvedOut[0].ingredientName,
      reason: 'no_macro_data',
      unresolvedCount: carvedOut.length,
    };
  }

  return undefined;
}
