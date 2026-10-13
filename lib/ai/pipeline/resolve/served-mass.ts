/**
 * A dish the user weighed ("350g chicken tikka masala") carries that weight
 * from Call 1 as `servedMassG`, and no part of it is pinned. Call 2 sizes the
 * parts from a sense of a normal serving, so they rarely add up to the typed
 * weight. Here each weighed dish's parts are scaled so the mass the bridge
 * ships for them adds up to what the user typed.
 */
import type {
  DecomposedDishV2,
  DecomposedIngredientV2,
} from '@/lib/ai/pipeline/contracts/schemas/decomposition-v2';
import type { GroundedIngredientEstimate } from '@/lib/ai/pipeline/contracts/schemas/grounded-estimation';
import type { RunState } from '@/lib/ai/pipeline/grounded/run-state';
import { shippedEdibleGrams } from '@/lib/ai/pipeline/resolve/refuse-mass';
import { pairIngredientsWithGrounded } from '@/lib/ai/pipeline/resolve/verdicts';

/** The parts move by at most this factor either way; past it, trust Call 2. */
const MAX_FACTOR = 3;
/** Closer than this to the typed weight already, the parts are left alone. */
const TOLERANCE = 0.02;

/**
 * A dish served in its own liquid (soup, stew, curry, braise) whose parts list
 * no liquid: the typed weight counts broth Call 1 never wrote down (plain
 * water), so the parts may only shrink to it, never grow into it.
 */
const LIQUID_DISH =
  /soup|stew|curry|braise|chili|hotpot|ramen|pho\b|phở|bún bò|bún riêu|hủ tiếu|miến|bánh canh|cháo|congee|laksa|canh|lẩu|\bkho\b|cà ri|cari|ninh|hầm/i;
/** A part that is the dish's liquid. Fish sauce and soy sauce are seasonings. */
const LIQUID_PART =
  /broth|stock|nước dùng|nước lèo|nước súp|nước canh|nước kho|coconut milk|nước cốt dừa|cream|gravy|curry sauce|sốt cà ri|water|nước lọc/i;

/**
 * A one-part "dish" the user weighed ("almonds 100g") is that food's own typed
 * weight: Call 1 sometimes writes it on the dish instead of the food. Returns
 * the food with that weight as its `explicitMass`, so the portion resolver
 * pins it; any other food comes back as it was.
 */
export function withDishWeight(
  dish: DecomposedDishV2,
  ingredient: DecomposedIngredientV2
): DecomposedIngredientV2 {
  if (!dish.servedMassG || dish.ingredients.length !== 1) return ingredient;
  if (ingredient.explicitMass) return ingredient;
  return {
    ...ingredient,
    explicitMass: { grams: dish.servedMassG, basis: 'unknown' },
  };
}

/** An estimate with its mass and macros multiplied by `k`. */
export function scaleEstimate(
  e: GroundedIngredientEstimate,
  k: number
): GroundedIngredientEstimate {
  const t = (b: GroundedIngredientEstimate['fatG']) => ({
    low: b.low * k,
    mid: b.mid * k,
    high: b.high * k,
  });
  return {
    ...e,
    grossG: e.grossG * k,
    proteinG: t(e.proteinG),
    carbohydrateG: t(e.carbohydrateG),
    fatG: t(e.fatG),
  };
}

/**
 * Scale every weighed dish's free parts so the shipped grams of the dish add
 * up to its `servedMassG`. A part pinned by a weight or package size of its
 * own keeps it and counts toward the total; a part the resolver withheld
 * ships nothing and is skipped. Returns new state and how many dishes moved.
 */
export function scaleToServedMass(state: RunState): {
  state: RunState;
  scaled: number;
} {
  const grounded = structuredClone(state.grounded);
  const pairs = pairIngredientsWithGrounded(state.decomposition, grounded);
  let scaled = 0;
  state.decomposition.mealItems.forEach((dish, d) => {
    const target = dish.servedMassG;
    if (!target || dish.ingredients.length < 2) return;
    let pinned = 0;
    let free = 0;
    const freeParts: GroundedIngredientEstimate[] = [];
    pairs.forEach(({ mealItemIdx, ingredient, ground }, f) => {
      if (mealItemIdx !== d || !ground) return;
      const portion = state.portionResolutions[f];
      if (portion?.provenance === 'unresolved') return;
      const grams = shippedEdibleGrams(
        ground,
        ingredient,
        state.matchResults[f],
        portion
      );
      // The same anchor test `shippedEdibleGrams` applies: an anchored part
      // ships its anchor whatever its grossG, so it cannot be scaled.
      const anchored =
        portion?.provenance !== 'llm_range' && (portion?.grams?.mid ?? 0) > 0;
      if (anchored) pinned += grams;
      else {
        free += grams;
        freeParts.push(ground);
      }
    });
    if (free <= 0) return;
    const parts = dish.ingredients
      .map((i) => `${i.rawName} ${i.canonicalName}`)
      .join(' | ');
    const unlistedLiquid =
      LIQUID_DISH.test(`${dish.name} ${dish.cookingMethod}`) &&
      !LIQUID_PART.test(parts);
    const k = Math.min(
      unlistedLiquid ? 1 : MAX_FACTOR,
      Math.max(1 / MAX_FACTOR, (target - pinned) / free)
    );
    if (Math.abs(k - 1) < TOLERANCE) return;
    for (const ground of freeParts)
      Object.assign(ground, scaleEstimate(ground, k));
    scaled++;
  });
  return { state: { ...state, grounded }, scaled };
}
