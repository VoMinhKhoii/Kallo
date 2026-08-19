import { resolvePreMatchAlias } from '@/lib/ai/matching/alias/aliases';
import type { DbIngredientState } from '@/lib/ai/matching/match-constants';
import { readBooleanEnv } from '@/lib/ai/pipeline/config/feature-flags';
import { deriveExpectedState } from '@/lib/ai/pipeline/contracts/cooking-method-state';
import type { DecomposedIngredientV2 } from '@/lib/ai/pipeline/contracts/schemas/decomposition-v2';

/**
 * Everything the v2 cascade decides about an ingredient BEFORE any lookup:
 * the name it will search under, and the state it expects the matched row to
 * be in.
 */
export interface IngredientWithContext {
  ingredient: DecomposedIngredientV2;
  index: number;
  matchingName: string;
  expectedState: DbIngredientState;
  dishCookingMethod: string | null;
}

/**
 * Coarse implicit-state inference from the v2 decomposition input. The
 * matcher uses this only to apply STATE_MISMATCH_PENALTY; the LLM in Call 2
 * still owns the final state interpretation via CRAG verdict + grams.
 *
 * Routes through the canonical `deriveExpectedState` helper so the raw-method
 * vocabulary stays single-sourced (`COOKING_METHOD_STATE`).
 */
function deriveExpectedStateFromV2(
  ingredient: DecomposedIngredientV2,
  dishCookingMethod: string | null | undefined
): DbIngredientState {
  const weightBasis =
    ingredient.stateHint === 'raw_weight'
      ? 'raw'
      : ingredient.stateHint === 'cooked_weight'
        ? 'as_eaten'
        : undefined;
  const { state, source } = deriveExpectedState({
    explicit: undefined,
    dishMethod: ingredient.cookingMethod ?? dishCookingMethod ?? null,
    weightBasis,
  });
  // Preserve v2's prior "unknown when method is empty" semantics so the
  // STATE_MISMATCH_PENALTY does not fire for genuinely-unknown ingredients.
  return source === 'unknown' ? 'unknown' : state;
}

/** Explicit user-stated weighing basis, or null when the user said nothing. */
export function explicitWeighState(
  ingredient: DecomposedIngredientV2
): 'raw' | 'cooked' | null {
  if (ingredient.stateHint === 'raw_weight') return 'raw';
  if (ingredient.stateHint === 'cooked_weight') return 'cooked';
  return null;
}

/**
 * Build the per-ingredient lookup context.
 *
 * Pre-match alias rewrite (gated, mirrors v1 cascade.ts): rewrite known
 * surface forms — incl. the curated exact-alias staples — to a canonical
 * VN-FCT name before any lookup. Original names are preserved for display.
 */
export function buildIngredientContexts(
  ingredients: DecomposedIngredientV2[],
  dishCookingMethods: Array<string | null>
): IngredientWithContext[] {
  const preMatchAliasEnabled = readBooleanEnv(
    'PIPELINE_PREMATCH_ALIAS_ENABLED',
    true
  );
  const rewriteName = (name: string): string => {
    if (!preMatchAliasEnabled) return name;
    const alias = resolvePreMatchAlias(name);
    if (alias !== name) {
      console.info(`[v2-matching] pre-match alias: "${name}" → "${alias}"`);
    }
    return alias;
  };

  return ingredients.map((ing, i) => ({
    ingredient: ing,
    index: i,
    matchingName: rewriteName(ing.canonicalName),
    expectedState: deriveExpectedStateFromV2(ing, dishCookingMethods[i]),
    dishCookingMethod: dishCookingMethods[i] ?? null,
  }));
}
