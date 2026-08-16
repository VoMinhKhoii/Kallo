/**
 * One ingredient's trip from Call-2 verdict to a shippable v1 row.
 *
 * The decision chain, in order, is the whole of this module:
 *   1. verdict      — did Call 2 accept a candidate, reject them all, or drop
 *                     the ingredient entirely?
 *   2. mass         — grossG + refusePct, or a server portion anchor that
 *                     overrides Call 2 outright.
 *   3. macro source — a DB row, Call 2's triples, or nothing real at all.
 *   4. plausibility — telemetry on whether the resolved numbers make sense.
 *   5. shape        — the v1 ingredient plus the matched / unmatched / raw
 *                     macro rows the legacy assembly expects.
 *
 * Every branch returns; nothing is mutated. `resolve.ts` owns the walk and the
 * accumulators, so this stays a pure function of one ingredient's inputs and
 * the id-independent half of the output can be assembled before
 * `ensureIdsOnDecomposition` has run.
 */

import type { IngredientV2MatchResult } from '@/lib/ai/matching/top-k-cascade';
import type {
  DecomposedDishV2,
  DecomposedIngredientV2,
} from '@/lib/ai/pipeline/contracts/schemas/decomposition-v2';
import type { GroundedIngredientEstimate } from '@/lib/ai/pipeline/contracts/schemas/grounded-estimation';
import type { PortionResolution } from '@/lib/ai/portion/types';
import type {
  DecomposedIngredient,
  MatchedIngredient,
  UnmatchedIngredient,
} from '@/lib/ai/types';
import type { RawNutritionAdjustment } from './macro-resolution';
import {
  resolveMacroSource,
  scaleGroundedMacros,
} from './macros/macro-scaling';
import type {
  CarvedOutIngredient,
  PlausibilityPerIngredient,
  VerdictPerIngredient,
} from './output';
import { classifyIngredientPlausibility } from './plausibility/plausibility';
import { resolveGroundedMass } from './refuse-mass';
import {
  buildNullNutrition,
  classifyVerdict,
  v2IngredientToV1,
} from './verdicts';

type RawIngredientMacros =
  RawNutritionAdjustment['mealItems'][number]['ingredients'][number];

/**
 * How the no-data carve-out disposed of an ingredient. `explicit_zero` is
 * counted but never reported (the row is SUPPOSED to be absent); `withheld`
 * is the entry the completeness gate may fail the meal over.
 */
export type CarveOutDisposition =
  | { kind: 'explicit_zero' }
  | {
      kind: 'withheld';
      entry: Omit<CarvedOutIngredient, 'activeIngredientCount'>;
    };

/**
 * Everything one ingredient contributes to `V2BridgeOutput`, minus the
 * run-scoped ids that only exist after `ensureIdsOnDecomposition`.
 */
export interface IngredientResolution {
  /** Verdict trail entry. Always produced, carved out or not. */
  verdict: VerdictPerIngredient;
  /** Plausibility trail entry, awaiting its `ingredientId`. */
  plausibility: Omit<PlausibilityPerIngredient, 'ingredientId'>;
  /** The v1-shape ingredient. Always produced so streamed ids stay valid. */
  v1Ingredient: DecomposedIngredient;
  /** Set when the row carried no usable macro source and was withheld. */
  carveOut: CarveOutDisposition | null;
  /** DB-anchored match data, awaiting its `ingredientId`. */
  matched: Omit<MatchedIngredient, 'ingredientId'> | null;
  /** Set when the row rides Call 2's macros rather than a DB anchor. */
  unmatched: UnmatchedIngredient | null;
  /** Absolute macro triples for `RawNutritionAdjustment`. Null when carved out. */
  rawMacros: RawIngredientMacros | null;
}

export function resolveIngredient(args: {
  ingredient: DecomposedIngredientV2;
  mealItem: DecomposedDishV2;
  mealItemIdx: number;
  ingredientIdx: number;
  /** Call 2's estimate for this ingredient, or null when it dropped it. */
  ground: GroundedIngredientEstimate | null;
  matchResult: IngredientV2MatchResult | undefined;
  /** Phase 3 portion-resolver output for this flat index, when the run had one. */
  portion: PortionResolution | undefined;
  mealContext: string;
}): IngredientResolution {
  const {
    ingredient: ing,
    mealItem: mi,
    mealItemIdx,
    ingredientIdx,
    ground,
    matchResult,
    portion,
    mealContext,
  } = args;

  const candidates = matchResult?.candidates ?? [];
  const { verdict, selectedCandidateIdx, rejectReason } = classifyVerdict(
    ground,
    candidates.length
  );
  const cookingMethodForIng = ing.cookingMethod ?? mi.cookingMethod;
  // Server ANCHOR override (Phase 3): when the portion resolver grounded
  // grams (ladder steps 1–4), that number is authoritative — Call 2 must
  // not drift from it. Prefer the resolver's grams over the LLM's.
  const authoritativeMass =
    portion &&
    portion.grams != null &&
    portion.provenance !== 'llm_range' &&
    portion.provenance !== 'unresolved' &&
    Number.isFinite(portion.grams.mid) &&
    portion.grams.mid > 0
      ? {
          grams: portion.grams.mid,
          basis: portion.massBasis ?? 'unknown',
        }
      : null;
  const acceptedCandidate =
    verdict === 'accepted' && selectedCandidateIdx !== null
      ? candidates[selectedCandidateIdx]
      : null;
  const mass = resolveGroundedMass({
    ground,
    candidateInediblePct: acceptedCandidate?.inediblePct ?? null,
    canonicalName: ing.canonicalName,
    rawName: ing.rawName,
    prepNotes: ing.prepNotes,
    authoritativeMass,
  });
  const resolvedEdibleGrams = mass.edibleG;
  // When the resolver couldn't ground a portion, label the ingredient
  // unresolved in the telemetry trail regardless of whatever Call 2
  // emitted. Diagnostic only — Call 2's edible grams still ship.
  const resolverUnresolved = portion?.provenance === 'unresolved';
  if (mass.refuse?.degenerateZero) {
    console.warn('[v2-pipeline] refuse_pct_degenerate_zero', {
      mealItemIdx,
      ingredientIdx,
      ingredientName: ing.rawName,
      ...mass.refuse,
    });
  }

  // Where this ingredient's macros come from — see `resolveMacroSource`.
  const macroSource = resolveMacroSource({
    acceptedCandidate,
    ground,
    resolvedGrams: resolvedEdibleGrams,
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
        mass.modelEdibleG != null &&
        mass.modelEdibleG > 0
      ? (ground.carbohydrateG.mid / mass.modelEdibleG) * 100
      : null;

  const state = resolverUnresolved
    ? 'unresolved_estimate'
    : classifyIngredientPlausibility({
        grams: resolvedEdibleGrams,
        hasNutrition: ground != null,
        caloriesPer100g: acceptedCandidate?.nutrition?.caloriesKcal ?? null,
        carbsPer100g,
        name: ing.rawName || ing.canonicalName,
      });

  const base = {
    verdict: {
      mealItemIdx,
      ingredientIdx,
      verdict,
      selectedCandidateIdx,
      rejectReason,
      grounded: ground,
      refuse: mass.refuse,
    } satisfies VerdictPerIngredient,
    plausibility: {
      mealItemIdx,
      ingredientIdx,
      ingredientName: ing.rawName,
      mealItemName: mi.name,
      state,
      ...(state === 'unresolved_estimate' && portion?.unresolvedReason
        ? { unresolvedReason: portion.unresolvedReason }
        : {}),
    },
  };

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
    return {
      ...base,
      v1Ingredient: v2IngredientToV1(ing, cookingMethodForIng, 0, undefined),
      carveOut:
        macroSource.reason === 'explicit_zero'
          ? { kind: 'explicit_zero' }
          : {
              kind: 'withheld',
              entry: {
                mealItemName: mi.name,
                ingredientName: ing.rawName,
                reason: macroSource.reason,
                mealItemIdx,
              },
            },
      matched: null,
      unmatched: null,
      rawMacros: null,
    };
  }

  const grams = resolvedEdibleGrams as number;
  const rawMacros: RawIngredientMacros = {
    ingredientName: ing.rawName,
    // Rescaled when a server anchor overrode Call 2's mass — see
    // `scaleGroundedMacros`.
    ...scaleGroundedMacros(ground, grams, mass.modelEdibleG),
  };

  if (isDbAnchored && acceptedCandidate) {
    const dbState = acceptedCandidate.info.state;
    // For raw or unknown candidates, force weightBasis='raw' so
    // computeDbScalingGrams skips convertCookedToRaw. For cooked
    // candidates, omitting weightBasis still yields grams unchanged
    // (computeDbScalingGrams's cooked-state path returns input grams).
    const weightBasis: 'raw' | undefined =
      dbState === 'raw' || dbState === 'unknown' ? 'raw' : undefined;
    return {
      ...base,
      v1Ingredient: v2IngredientToV1(
        ing,
        cookingMethodForIng,
        grams,
        weightBasis
      ),
      carveOut: null,
      matched: {
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
      },
      unmatched: null,
      rawMacros,
    };
  }

  // Unmatched OR rejected but resolvable: Call 2 macros flow through.
  return {
    ...base,
    v1Ingredient: v2IngredientToV1(ing, cookingMethodForIng, grams, undefined),
    carveOut: null,
    matched: null,
    unmatched: {
      ingredientName: ing.rawName,
      mealContext: rejectReason
        ? `${mealContext} (rejected: ${rejectReason})`
        : mealContext,
    },
    rawMacros,
  };
}
