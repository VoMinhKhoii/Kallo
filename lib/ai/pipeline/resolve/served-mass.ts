/**
 * A dish the user weighed ("350g chicken tikka masala") carries that weight
 * from Call 1 as `servedMassG`, and no part of it is pinned. Call 2 sizes the
 * parts from a sense of a normal serving, so they rarely add up to the typed
 * weight. Here each weighed dish's parts are scaled so the as-served mass
 * behind what the bridge ships (bones and shells included: what the scale
 * read) adds up to what the user typed.
 */
import type {
  DecomposedDishV2,
  DecomposedIngredientV2,
} from '@/lib/ai/pipeline/contracts/schemas/decomposition-v2';
import type { GroundedIngredientEstimate } from '@/lib/ai/pipeline/contracts/schemas/grounded-estimation';
import type { RunState } from '@/lib/ai/pipeline/grounded/run-state';
import {
  selectedCandidate,
  shippedServedGrams,
} from '@/lib/ai/pipeline/resolve/refuse-mass';
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
  /(?<!\p{L})(?:soup|súp|stew(?:ed)?|curry|curried|braised?|chil(?:i|li)|hot ?pot|ramen|pho|phở|bún bò|bún riêu|hủ tiếu|miến|bánh canh|cháo|congee|laksa|canh|lẩu|kho|cà ri|cari|ninh|hầm)(?!\p{L})/iu;
/**
 * A solid food named after a liquid dish ("curry puff", "chili dog") or its
 * dry form ("miến xào", "miến trộn", "hủ tiếu khô"): its typed weight is all
 * food.
 */
const SOLID_FORM =
  /(?<!\p{L})(?:puff|dog|burger|bun|bread|pie|roll|crisp|fries|chips|fried rice|fried noodles|dry|xào|trộn|khô)(?!\p{L})|stir[-_ ]?fr/iu;
/** Where a dish weighed with its side splits into its foods. */
const SIDE_JOIN =
  /\s*(?:[,+&]|(?<!\p{L})(?:with|and|plus|kèm|với|và|thêm)(?!\p{L}))\s*/iu;
/**
 * A part that is the dish's liquid, by its whole name: English names end on
 * the liquid ("beef broth", not "water spinach" or "cream cheese"); the
 * Vietnamese ones name it outright. Fish sauce and soy sauce are seasonings.
 */
const LIQUID_PART_EN =
  /(?<!\p{L})(?:broth|stock|coconut milk|(?<!(?:sour|ice) )cream|gravy|curry sauce|water)$/iu;
const LIQUID_PART_VI =
  /(?<!\p{L})(?:nước dùng|nước lèo|nước súp|nước canh|nước kho|nước cốt dừa|sốt cà ri|nước lọc)(?!\p{L})/iu;

function isLiquidPart(ingredient: DecomposedIngredientV2): boolean {
  return [ingredient.rawName, ingredient.canonicalName].some(
    (n) => LIQUID_PART_EN.test(n.trim()) || LIQUID_PART_VI.test(n)
  );
}

/**
 * Any food in the item's name is a liquid dish not in a solid or dry form.
 * Each food is judged on its own, so "beef stew with bread" stays a stew; the
 * cooking method describes the first (main) food.
 */
function isLiquidDish(dish: DecomposedDishV2): boolean {
  return dish.name
    .split(SIDE_JOIN)
    .map((food, i) => (i === 0 ? `${food} ${dish.cookingMethod}` : food))
    .some((food) => LIQUID_DISH.test(food) && !SOLID_FORM.test(food));
}

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
    ...(e.servedG ? { servedG: e.servedG * k } : {}),
    proteinG: t(e.proteinG),
    carbohydrateG: t(e.carbohydrateG),
    fatG: t(e.fatG),
  };
}

/**
 * Scale every weighed dish's free parts so the as-served grams of the dish add
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
      const grams = shippedServedGrams(
        ground,
        ingredient,
        state.matchResults[f],
        portion
      );
      // The same anchor test `shippedServedGrams` applies: an anchored part
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
    const unlistedLiquid =
      isLiquidDish(dish) && !dish.ingredients.some(isLiquidPart);
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

/**
 * Telemetry: one line per part priced on a raw or dry row, with Call 2's
 * plate-to-row ratio. A dry staple in a cooked dish near 1 suggests cooked
 * grams on a dry row; read before deciding how to repair that.
 */
export function logRawRowYields(state: RunState): void {
  pairIngredientsWithGrounded(state.decomposition, state.grounded).forEach(
    ({ mealItemIdx, ingredient, ground }, f) => {
      const row = state.matchResults[f];
      if (!ground || selectedCandidate(ground, row)?.info.state !== 'raw')
        return;
      const dish = state.decomposition.mealItems[mealItemIdx];
      const ratio = ground.servedG
        ? (ground.servedG / ground.grossG).toFixed(2)
        : 'none';
      console.info(
        `[raw-row-yield] ${ingredient.canonicalName} | dish=${dish?.name} method=${dish?.cookingMethod} grossG=${Math.round(ground.grossG)} servedG=${ground.servedG ? Math.round(ground.servedG) : 'none'} ratio=${ratio}`
      );
    }
  );
}
