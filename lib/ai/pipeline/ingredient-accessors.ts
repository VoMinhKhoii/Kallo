import type { MealDecomposition } from '@/lib/ai/types';

type DecompositionIngredient =
  MealDecomposition['mealItems'][number]['ingredients'][number];

// Older runtime payloads (legacy `name`, pre-grams field rename) still flow
// through here, so we accept anything shaped like the union of past + present
// ingredient fields. Keeping the helpers centralized stops the fallback order
// from drifting between display, matching, and nutrition call sites.
type LooseIngredient = DecompositionIngredient & {
  name?: string;
  estimatedGrams?: number;
};

/** Best name to show the user. Prefer what they typed, then the LLM's
 * generic name, then the canonical form. */
export function ingredientDisplayName(ing: LooseIngredient): string {
  return ing.rawName ?? ing.name ?? ing.canonicalName ?? '';
}

/** Best name to use as a matching/lookup key against the food-composition
 * DB. Prefer the canonical form, then what the user typed, then the
 * generic name. */
export function ingredientCanonicalName(ing: LooseIngredient): string {
  return ing.canonicalName ?? ing.rawName ?? ing.name ?? '';
}

/** Cooked/as-eaten grams. Falls back to legacy `estimatedGrams` for older
 * payloads still shaped that way. */
export function ingredientGrams(ing: LooseIngredient): number {
  return ing.grams ?? ing.estimatedGrams ?? 0;
}
