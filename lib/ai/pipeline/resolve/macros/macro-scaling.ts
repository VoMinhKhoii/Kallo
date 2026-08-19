/**
 * Where a v2 ingredient's macros come from, and at what mass.
 *
 * Two questions get asked about every ingredient on the v2 bridge path, and
 * before this module they were answered in three different shapes scattered
 * through `bridgeV2ToV1`:
 *   1. is there ANY real macro source, or would a row carry only zeros?
 *   2. are Call 2's absolute triples scoped to the mass we are actually
 *      shipping, or did a server portion anchor override it?
 *
 * Both are macro-sourcing concerns, not verdict concerns, so they live here
 * rather than in `verdicts.ts`. `NoMacroReason` is part of the bridge's
 * published output contract, so it lives in `output.ts`.
 */

import type { GroundedIngredientEstimate } from '@/lib/ai/pipeline/contracts/schemas/grounded-estimation';
import type { BoundedEstimate } from '@/lib/ai/types/nutrition-values';
import type { RawNutritionAdjustment } from '../macro-resolution';
import type { NoMacroReason } from '../output';
import { ZERO_TRIPLE } from '../verdicts';
import { scaleBounded } from './macro-guard';

export type MacroSource =
  /** Accepted candidate with a nutrition row: the server anchors P/C/kcal. */
  | { kind: 'db' }
  /** Unmatched or rejected: Call 2's triple is the only source. */
  | { kind: 'llm' }
  /** Nothing real to ship — a row here would be fabricated zeros. */
  | { kind: 'none'; reason: NoMacroReason };

export function resolveMacroSource(args: {
  /** The accepted candidate, or null on the unmatched/rejected/missing path. */
  acceptedCandidate: { nutrition: unknown } | null;
  ground: GroundedIngredientEstimate | null;
  /** Anchor grams if the resolver grounded a portion, else Call 2's grams. */
  resolvedGrams: number | null;
  /** True when the portion resolver rejected an explicit zero count. */
  explicitZero?: boolean;
}): MacroSource {
  const { acceptedCandidate, ground, resolvedGrams, explicitZero } = args;
  if (explicitZero) return { kind: 'none', reason: 'explicit_zero' };
  if (resolvedGrams == null) return { kind: 'none', reason: 'no_portion' };
  if (ground == null) return { kind: 'none', reason: 'no_estimate' };
  // A DB row anchors P/C/kcal — the strongest source, so prefer it.
  if (acceptedCandidate?.nutrition != null) return { kind: 'db' };
  // No DB anchor (unmatched, rejected, or an accepted candidate whose
  // nutrition never loaded): Call 2's triples carry the row. The schema makes
  // all four triples REQUIRED (D3 optionality reverted after the mì-gói
  // incident, where an omitted carbohydrateG became a persisted C:0g), so a
  // parsed `ground` always has a full set of numbers. Whether those numbers
  // are PLAUSIBLE is the plausibility classifier's job, not this function's —
  // an explicit zero from the model ships, flagged in telemetry.
  return { kind: 'llm' };
}

/**
 * Call 2 emits ABSOLUTE macro triples scoped to its OWN assumed edible mass
 * (`grams`, or `grossG` after its model refusePct). When
 * the server portion anchor overrode that mass (resolver ladder steps 1-4),
 * the triples must be rescaled or the row displays the anchor's grams carrying
 * the LLM's macros — a 150g estimate anchored to 330g under-reports by 2.2×.
 * Matched ingredients have P/C overwritten from the DB base downstream, but
 * their fat still flows from here into `guardMacro`, so scaling helps there
 * too (an unscaled fat would spuriously trip the undershoot clamp).
 */
export function scaleGroundedMacros(
  ground: GroundedIngredientEstimate | null,
  resolvedGrams: number,
  modelEdibleGrams?: number | null
): Pick<
  RawNutritionAdjustment['mealItems'][number]['ingredients'][number],
  'caloriesKcal' | 'proteinG' | 'carbohydrateG' | 'fatG'
> {
  const llmGrams =
    modelEdibleGrams ??
    (ground && 'grams' in ground && typeof ground.grams === 'number'
      ? ground.grams
      : undefined);
  const raw =
    llmGrams != null && Number.isFinite(llmGrams) && llmGrams > 0
      ? resolvedGrams / llmGrams
      : 1;
  // Validate the QUOTIENT, not just the operands: two individually finite
  // masses can still overflow, and an Infinity factor poisons the triples
  // (the density clamp then multiplies by 0 and yields NaN).
  const factor = Number.isFinite(raw) && raw > 0 ? raw : 1;
  const s = (b: BoundedEstimate | null | undefined): BoundedEstimate =>
    b == null ? ZERO_TRIPLE : factor === 1 ? b : scaleBounded(b, factor);
  return {
    caloriesKcal: s(ground?.caloriesKcal),
    proteinG: s(ground?.proteinG),
    carbohydrateG: s(ground?.carbohydrateG),
    fatG: s(ground?.fatG),
  };
}
