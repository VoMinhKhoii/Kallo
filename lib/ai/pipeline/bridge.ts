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

import type { IngredientV2MatchResult } from '../matching/top-k-cascade';
import type { PortionResolution } from '../portion/types';
import type {
  DecomposedIngredient,
  DecomposedMealItem,
  MatchedIngredient,
  MealDecomposition,
  UnmatchedIngredient,
} from '../types';
import { resolveMacroSource, scaleGroundedMacros } from './bridge-macros';
import type {
  CarvedOutIngredient,
  PlausibilityPerIngredient,
  V2BridgeOutput,
  VerdictPerIngredient,
} from './bridge-output';
import {
  buildNullNutrition,
  classifyVerdict,
  pairIngredientsWithGrounded,
  v2DishToV1,
  v2IngredientToV1,
} from './bridge-verdicts';
import { ensureIdsOnDecomposition } from './ids';
import type { RawNutritionAdjustment } from './nutrition';
import { classifyIngredientPlausibility } from './plausibility';
import type { GroundedEstimation, MealDecompositionV2 } from './schemas-v2';

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
  const v1MealItems: DecomposedMealItem[] = [];
  // Per-flat-index partial matched data (without ingredientId yet — populated
  // after ensureIdsOnDecomposition assigns run-scoped ids).
  const matchedPartialByFlatIdx = new Map<
    number,
    Omit<MatchedIngredient, 'ingredientId'>
  >();
  const unmatched: UnmatchedIngredient[] = [];
  const carvedOut: CarvedOutIngredient[] = [];
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
      const portion = portionResolutions?.[flatIngredientIdx];
      // Server ANCHOR override (Phase 3): when the portion resolver grounded
      // grams (ladder steps 1–4), that number is authoritative — Call 2 must
      // not drift from it. Prefer the resolver's grams over the LLM's.
      const anchorGrams =
        portion &&
        portion.grams != null &&
        portion.provenance !== 'llm_range' &&
        portion.provenance !== 'unresolved' &&
        Number.isFinite(portion.grams.mid) &&
        portion.grams.mid > 0
          ? portion.grams.mid
          : null;
      // NO FALLBACK_GRAMS: a missing/invalid grams is left unresolved rather
      // than coerced to a 1g placeholder row. `schemas-v2.ts` enforces
      // grams.positive().finite() at parse time, so an invalid value here can
      // only mean Call 2 dropped the ingredient entirely (verdict='missing').
      const llmGrams =
        ground?.grams != null &&
        Number.isFinite(ground.grams) &&
        ground.grams > 0
          ? ground.grams
          : null;
      const resolvedGrams = anchorGrams ?? llmGrams;
      // When the resolver couldn't ground a portion, label the ingredient
      // unresolved in the telemetry trail regardless of whatever grams Call 2
      // emitted. Diagnostic only — Call 2's grams still ship.
      const resolverUnresolved = portion?.provenance === 'unresolved';

      const acceptedCandidate =
        verdict === 'accepted' && selectedCandidateIdx !== null
          ? candidates[selectedCandidateIdx]
          : null;

      // Where this ingredient's macros come from — see `resolveMacroSource`.
      const macroSource = resolveMacroSource({
        acceptedCandidate,
        ground,
        resolvedGrams,
        explicitZero: portion?.unresolvedReason === 'explicit_zero',
      });
      // A DB row anchors P/C/kcal; anything else rides Call 2's triple.
      const isDbAnchored = macroSource.kind === 'db';

      // Carb density for the carb-staple floor. DB-anchored: per-100g carbs.
      // Otherwise: Call 2's absolute carb mid over the mass IT assumed — NOT
      // `resolvedGrams`. Density is mass-invariant under the anchor rescale,
      // and dividing an unscaled carb by anchored grams would understate it
      // (9g/150g = 6g/100g reads as 2.7g/100g at a 330g anchor) and falsely
      // trip the staple floor.
      const carbsPer100g = isDbAnchored
        ? (acceptedCandidate?.nutrition?.carbohydrateG ?? null)
        : ground?.carbohydrateG != null &&
            Number.isFinite(ground.grams) &&
            ground.grams > 0
          ? (ground.carbohydrateG.mid / ground.grams) * 100
          : null;

      const state = resolverUnresolved
        ? 'unresolved_estimate'
        : classifyIngredientPlausibility({
            grams: resolvedGrams,
            hasNutrition: ground != null,
            caloriesPer100g: acceptedCandidate?.nutrition?.caloriesKcal ?? null,
            carbsPer100g,
            name: ing.rawName || ing.canonicalName,
          });
      plausibilityPartialByFlatIdx.set(flatIngredientIdx, {
        mealItemIdx,
        ingredientIdx,
        ingredientName: ing.rawName,
        mealItemName: mi.name,
        state,
        ...(state === 'unresolved_estimate' && portion?.unresolvedReason
          ? { unresolvedReason: portion.unresolvedReason }
          : {}),
      });

      // NO-DATA carve-out: no portion, no estimate, or an explicit user zero —
      // a row here could only carry fabricated zeros, and the picker merely
      // scales, so a zero row stays zero however far it is dragged. Withhold
      // instead — the ingredient stays in the decomposition so streamed ids
      // hold, and the per-ingredient completeness gate reports it. Every OTHER
      // unresolved cause (staple floor, ambiguous concept, too-wide band)
      // still ships on real grams; a present-but-zero macro from Call 2 ships
      // too, flagged by plausibility telemetry (schema requires all triples,
      // so "omitted" no longer exists as a state).
      if (macroSource.kind === 'none' && state !== 'genuinely_noncaloric') {
        // Loud: the ingredient vanishes from the meal's totals and the route's
        // meal-level check still passes if ANY other item has macros, so
        // without this the undercount is invisible in prod.
        console.warn(
          `[bridge] no_data_carveout: dropped "${ing.rawName}" in "${mi.name}" (${macroSource.reason}, state=${state})`
        );
        if (macroSource.reason !== 'explicit_zero') {
          carvedOut.push({
            mealItemName: mi.name,
            ingredientName: ing.rawName,
            reason: macroSource.reason,
          });
        }
        v1Ings.push(v2IngredientToV1(ing, cookingMethodForIng, 0, undefined));
        flatIngredientIdx++;
        return;
      }

      const grams = resolvedGrams as number;
      let weightBasis: 'raw' | undefined;
      let v1Ing: DecomposedIngredient;

      if (isDbAnchored && acceptedCandidate) {
        const dbState = acceptedCandidate.info.state;
        // For raw or unknown candidates, force weightBasis='raw' so
        // computeDbScalingGrams skips convertCookedToRaw. For cooked
        // candidates, omitting weightBasis still yields grams unchanged
        // (computeDbScalingGrams's cooked-state path returns input grams).
        if (dbState === 'raw' || dbState === 'unknown') weightBasis = 'raw';
        v1Ing = v2IngredientToV1(ing, cookingMethodForIng, grams, weightBasis);
        matchedPartialByFlatIdx.set(flatIngredientIdx, {
          ingredientName: ing.rawName,
          foodCompositionId: acceptedCandidate.info.foodCompositionId,
          foodGroupEn: acceptedCandidate.info.foodGroupEn,
          matchedName: acceptedCandidate.info.matchedName,
          similarity: acceptedCandidate.info.similarity,
          confidence: acceptedCandidate.info.confidence,
          dbState: dbState,
          matchType: acceptedCandidate.info.matchType,
          source: acceptedCandidate.info.source,
          nutritionPer100g: acceptedCandidate.nutrition ?? buildNullNutrition(),
        });
      } else {
        // Unmatched OR rejected but resolvable: Call 2 macros flow through.
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
        // Rescaled when a server anchor overrode Call 2's mass — see
        // `scaleGroundedMacros`.
        ...scaleGroundedMacros(ground, grams),
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
