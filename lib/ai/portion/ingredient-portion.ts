/**
 * Adapter: turn v2 decomposition ingredients + user context into portion
 * resolutions via the fallback ladder. This is the glue the orchestrator runs
 * between matching and Call 2.
 *
 * Concept resolution keys off the ingredient surface forms (rawName then
 * canonicalName). Form is derived from cooking method / state hint; locale from
 * the user's input language (a PRIOR, not a hard filter — priors.ts loosens to
 * global when no locale-specific prior exists).
 */

import type { DecomposedIngredientV2 } from '../pipeline/schemas-v2';
import { AMBIGUOUS } from './lexicon/concept-aliases';
import { resolveConcept } from './lexicon/concepts';
import { resolvePortion } from './resolver';
import type {
  FoodForm,
  Locale,
  PortionResolution,
  QuantityEvidence,
  ResolverConceptInput,
} from './types';

const RAW_METHODS = /raw|sống|tươi/i;

/**
 * Coarse form derivation. `composed` is reserved for concepts that are
 * inherently prepared dishes (handled by the prior's own `form` field), so
 * here we only distinguish raw vs cooked from the cooking signal.
 */
function deriveForm(
  ingredient: DecomposedIngredientV2,
  dishCookingMethod: string | null | undefined
): FoodForm {
  if (ingredient.stateHint === 'raw_weight') return 'raw';
  if (ingredient.stateHint === 'cooked_weight') return 'cooked';
  const method = ingredient.cookingMethod ?? dishCookingMethod ?? '';
  if (RAW_METHODS.test(method)) return 'raw';
  return method.trim().length > 0 ? 'cooked' : 'any';
}

function deriveLocale(inputLanguage: string | undefined): Locale {
  return inputLanguage === 'vi'
    ? 'vi'
    : inputLanguage === 'en'
      ? 'en'
      : 'global';
}

function buildQuantityEvidence(
  ingredient: DecomposedIngredientV2
): QuantityEvidence {
  return {
    count: ingredient.count,
    unitToken: ingredient.unitToken,
    sizeModifier: ingredient.sizeModifier,
    explicitMass: ingredient.explicitMass,
  };
}

/**
 * Resolve one ingredient's portion. Concept resolution tries rawName first
 * (closest to what the user typed), then canonicalName. An AMBIGUOUS hit on
 * either surface form marks the concept ambiguous so the ladder clarifies.
 */
export function resolveIngredientPortion(args: {
  ingredient: DecomposedIngredientV2;
  dishCookingMethod: string | null | undefined;
  inputLanguage: string | undefined;
  dbServingSizeG?: number | null;
}): PortionResolution {
  const { ingredient, dishCookingMethod, inputLanguage } = args;

  const byRaw = resolveConcept(ingredient.rawName);
  // Call 1 often separates a counter from the food name (`1 con cá` becomes
  // rawName=`cá`, unitToken=`con`). Recompose only for exact concept lookup;
  // the unit still carries no grams without the resulting scoped prior.
  const byRawWithUnit = ingredient.unitToken
    ? (resolveConcept(`${ingredient.unitToken} ${ingredient.rawName}`) ??
      resolveConcept(`${ingredient.rawName} ${ingredient.unitToken}`))
    : null;
  const byCanonical = resolveConcept(ingredient.canonicalName);
  const resolution = byRaw ?? byRawWithUnit ?? byCanonical;
  // Raw user language is authoritative for the portion concept. A wrong or
  // generic selected-row canonical name must not erase a valid raw anchor.
  const ambiguous = resolution === AMBIGUOUS;

  const conceptId = resolution && resolution !== AMBIGUOUS ? resolution : null;

  const conceptInput: ResolverConceptInput = {
    conceptId: ambiguous ? AMBIGUOUS : conceptId,
    ambiguous,
    locale: deriveLocale(inputLanguage),
    form: deriveForm(ingredient, dishCookingMethod),
    rawName: ingredient.rawName,
    canonicalName: ingredient.canonicalName,
    dbServingSizeG: args.dbServingSizeG ?? null,
  };

  return resolvePortion(conceptInput, buildQuantityEvidence(ingredient));
}

/**
 * Resolve portions for a flat list of ingredients (orchestrator entry point).
 * Returns one resolution per input, in order. DB serving/package weights are
 * threaded per-ingredient when the caller has them (rare for FAO rows).
 */
export function resolveFlatIngredientPortions(
  flat: Array<{
    ingredient: DecomposedIngredientV2;
    dishCookingMethod: string | null | undefined;
    dbServingSizeG?: number | null;
  }>,
  inputLanguage: string | undefined
): PortionResolution[] {
  return flat.map((f) =>
    resolveIngredientPortion({
      ingredient: f.ingredient,
      dishCookingMethod: f.dishCookingMethod,
      inputLanguage,
      dbServingSizeG: f.dbServingSizeG,
    })
  );
}

/** Extract the anchor grams (mid) from a resolution, or null when deferred. */
export function anchorGramsFromResolution(r: PortionResolution): number | null {
  if (!r.grams) return null;
  if (r.provenance === 'llm_range' || r.provenance === 'unresolved')
    return null;
  if (r.massBasis !== 'edible') return null;
  return r.grams.mid;
}

/**
 * Orchestrator seam: resolve portions for the flat ingredient list and derive
 * the Call-2 anchor array in one call. Keeps the ladder wiring out of the
 * orchestrator body (which is at the file-size ratchet).
 */
export function resolvePortionsForCallTwo(
  flat: Array<{
    ingredient: DecomposedIngredientV2;
    dishCookingMethod: string | null | undefined;
  }>,
  inputLanguage: string | undefined
): {
  resolutions: PortionResolution[];
  anchors: Array<number | null>;
} {
  const resolutions = resolveFlatIngredientPortions(flat, inputLanguage);
  return {
    resolutions,
    anchors: resolutions.map(anchorGramsFromResolution),
  };
}
