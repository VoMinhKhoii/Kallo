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
 * rather than in `bridge-verdicts.ts`.
 */

import type { BoundedEstimate } from '../types';
import { scaleBounded } from './bounded-macros';
import { ZERO_TRIPLE } from './bridge-verdicts';
import type { RawNutritionAdjustment } from './nutrition';
import { isCarbStapleName } from './plausibility';
import type { GroundedIngredientEstimate } from './schemas-v2';

/** Why an ingredient has no usable macro source. Drives the carve-out log. */
export type NoMacroReason =
  /** Neither the portion anchor nor Call 2 produced grams. */
  | 'no_portion'
  /** Call 2 dropped the ingredient entirely (verdict='missing'). */
  | 'no_estimate'
  /**
   * No DB row AND no usable Call-2 triple. `schemas-v2` makes proteinG and
   * carbohydrateG independently optional, so either omission degrades that
   * macro to ZERO_TRIPLE — a fabricated zero the picker can never repair.
   * The prompt says both are "REQUIRED for unmatched", but never trust it.
   */
  | 'no_anchor'
  /**
   * The user typed an explicit zero ("0 fried chicken"). A contradiction, not
   * a portion — it must never produce calories (`resolver.ts` step 0).
   */
  | 'explicit_zero';

/**
 * Fat mass fraction above which fat alone characterizes the food. Butter is
 * ~81% fat and oil ~100%; a protein or starch never approaches half its mass
 * in fat, so 0.5 separates "fat IS the food" from "fat is one component".
 */
const FAT_FOOD_RATIO = 0.5;

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
  /**
   * Ingredient display name, for the carb-staple check below. Pass the SAME
   * expression the plausibility classifier gets (`rawName || canonicalName`)
   * so the two never disagree about what counts as a starch. Omitted → the
   * staple check is skipped (backward-compatible with callers that predate it).
   */
  name?: string;
}): MacroSource {
  const { acceptedCandidate, ground, resolvedGrams, explicitZero, name } = args;
  if (explicitZero) return { kind: 'none', reason: 'explicit_zero' };
  if (resolvedGrams == null) return { kind: 'none', reason: 'no_portion' };
  if (ground == null) return { kind: 'none', reason: 'no_estimate' };
  // A DB row anchors P/C/kcal — the strongest source, so prefer it.
  if (acceptedCandidate?.nutrition != null) return { kind: 'db' };
  // No DB anchor (unmatched, rejected, or an accepted candidate whose
  // nutrition never loaded). Call 2 can still carry the row: `fatG` is
  // schema-mandatory and kcal is DERIVED from P/C/F downstream
  // (`deriveCaloriesFromMacros`), so an omitted kcal costs nothing.
  //
  // Both P and C omitted leaves fat as the only signal. That is legitimate
  // ONLY when fat IS the food (butter, oil: ~0 protein, ~0 carb by nature) —
  // withholding there deleted a real ~700 kcal/100g ingredient. It is NOT
  // legitimate when fat is a minor component: 150g of ức gà carrying 4g fat
  // leaves 97% of the mass unaccounted, and shipping it would persist 36 kcal
  // and 0g protein — the D3 silent-undercount this guard exists to stop.
  // Mass fraction separates the two cleanly.
  // A present-but-implausible macro (the bánh-ướt C≈0 class) is not this
  // function's job — the carb-staple floor flags that in telemetry.
  // Compare against the mass the fat is SCOPED to (Call 2's own grams), not a
  // server anchor that may have overridden it — the ratio is invariant there,
  // and mixing the two would misjudge a butter pat anchored to a larger mass.
  const fatMid = ground.fatG?.mid ?? 0;
  const fatBasis =
    Number.isFinite(ground.grams) && ground.grams > 0
      ? ground.grams
      : resolvedGrams;
  const fatIsTheFood = fatMid > 0 && fatMid / fatBasis >= FAT_FOOD_RATIO;
  const uncharacterized =
    ground.proteinG == null && ground.carbohydrateG == null && !fatIsTheFood;
  if (uncharacterized) return { kind: 'none', reason: 'no_anchor' };
  // A STARCH with no carb triple is the same fabricated zero, one field over:
  // "Mì gói sữa" came back P:20 F:37 C:<omitted>, so `uncharacterized` was
  // false on the strength of protein alone and the row shipped at a literal
  // C:0 — 412 kcal derived from 4P + 9F. Carbs ARE the food for a rice/noodle/
  // bread base, so their absence leaves it as uncharacterized as a missing
  // protein leaves ức gà. Scoped to a null triple only: a present-but-
  // implausible carb stays telemetry (the staple floor in `plausibility.ts`),
  // which is the trade the clarify ask-back's removal deliberately made.
  if (ground.carbohydrateG == null && name != null && isCarbStapleName(name)) {
    return { kind: 'none', reason: 'no_anchor' };
  }
  return { kind: 'llm' };
}

/**
 * Call 2 emits ABSOLUTE macro triples scoped to its OWN assumed `grams`. When
 * the server portion anchor overrode that mass (resolver ladder steps 1-4),
 * the triples must be rescaled or the row displays the anchor's grams carrying
 * the LLM's macros — a 150g estimate anchored to 330g under-reports by 2.2×.
 * Matched ingredients have P/C overwritten from the DB base downstream, but
 * their fat still flows from here into `guardMacro`, so scaling helps there
 * too (an unscaled fat would spuriously trip the undershoot snap).
 */
export function scaleGroundedMacros(
  ground: GroundedIngredientEstimate | null,
  resolvedGrams: number
): Pick<
  RawNutritionAdjustment['mealItems'][number]['ingredients'][number],
  'caloriesKcal' | 'proteinG' | 'carbohydrateG' | 'fatG'
> {
  const llmGrams = ground?.grams;
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
