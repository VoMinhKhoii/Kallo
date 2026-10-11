/**
 * Review Call 2's row picks against the food they stand for, after the
 * selector and around the dish rescue (see the orchestrator):
 * - before the rescue, a pick whose own estimate contradicts the row (a paste
 *   or powder for a prepared dish) becomes a rejection, so the rescue can
 *   split it;
 * - after the rescue, a fried dish's separate oil row is dropped when its food
 *   matched a row that is already fried.
 */
import type { GroundedIngredientEstimate } from '@/lib/ai/pipeline/contracts/schemas/grounded-estimation';
import type { RunState } from '@/lib/ai/pipeline/grounded/rescue/rescue';
import { shippedEdibleGrams } from '@/lib/ai/pipeline/resolve/refuse-mass';
import { pairIngredientsWithGrounded } from '@/lib/ai/pipeline/resolve/verdicts';
import { isDiscreteOilIngredient } from '@/lib/domain/nutrition/absorbed-oil';

/** A wrong-form pick: the row must give more than this many times Call 2's own energy... */
const RATIO = 2;
/** ...and this many kcal more, so a small food's rounding never trips it. */
const MIN_GAP_KCAL = 100;

/**
 * A row Call 2 picked but whose numbers it did not believe: it matched a
 * concentrate or a dry form (miso paste for a bowl of miso soup, curry powder
 * for a curry) and then estimated the food the user actually ate. The server
 * ships the row × grams, so the wrong form would win (a bowl of miso soup as
 * 567 kcal). When the row gives more than twice the energy Call 2 estimated
 * for the same grams, the pick becomes a rejection: the ingredient ships Call
 * 2's own macros, and the dish rescue may split it. Returns new state.
 */
export function rejectWrongFormRows(state: RunState): {
  state: RunState;
  rejected: number;
} {
  const grounded = structuredClone(state.grounded);
  let rejected = 0;
  pairIngredientsWithGrounded(state.decomposition, grounded).forEach(
    ({ ingredient, ground }, f) => {
      const idx = /^c(\d+)$/.exec(ground?.selectedCandidateId ?? '')?.[1];
      const match = state.matchResults[f];
      const per100 = idx
        ? match?.candidates[Number(idx) - 1]?.nutrition?.caloriesKcal
        : null;
      if (!ground || per100 == null) return;
      const grams = shippedEdibleGrams(
        ground,
        ingredient,
        match,
        state.portionResolutions[f]
      );
      const rowKcal = (grams * per100) / 100;
      const estimateKcal =
        4 * ground.proteinG.mid +
        4 * ground.carbohydrateG.mid +
        9 * ground.fatG.mid;
      if (rowKcal <= RATIO * estimateKcal) return;
      if (rowKcal - estimateKcal <= MIN_GAP_KCAL) return;
      ground.selectedCandidateId = 'none';
      ground.rejectReason = `row form: the row gives ${Math.round(rowKcal)} kcal for ${Math.round(grams)} g, the estimate ${Math.round(estimateKcal)} kcal`;
      rejected++;
    }
  );
  return { state: { ...state, grounded }, rejected };
}

/** A row whose name says the food was fried in fat ("Egg, whole, cooked, fried"). */
const FRIED_ROW = /\bfried\b|chi[eê]n|\br[aá]n\b/i;
/** Fried without added fat, or a name where "fried" says nothing about the fat. */
const NOT_FAT_FRIED =
  /\b(?:pan|stir|air|dry)[- ]?fried\b|not breaded|kh[oô]ng d[aầ]u/i;
/** Lighter foods are seasonings and garnish; they do not decide the dish. */
const MIN_FOOD_G = 20;

/**
 * Call 1 logs a fried dish's cooking oil as its own row. That is right when
 * the food matched a plain row (raw egg, raw shrimp), and double counting when
 * it matched a row that is already fried ("Egg, whole, cooked, fried",
 * "Shrimp, breaded and fried"): that row's fat already holds the oil. A dish
 * whose every food (seasonings aside) matched a fried row loses its oil rows.
 * Returns new state.
 */
export function dropOilInFriedRows(state: RunState): {
  state: RunState;
  dropped: number;
} {
  const grounded = structuredClone(state.grounded);
  const pairs = pairIngredientsWithGrounded(state.decomposition, grounded);
  const drop = new Set<number>();
  let flat = 0;
  for (const mi of state.decomposition.mealItems) {
    const own = mi.ingredients.map((_, i) => flat + i);
    flat += mi.ingredients.length;
    const oils = own.filter((f) =>
      isDiscreteOilIngredient(pairs[f].ingredient.rawName)
    );
    const foods = own.filter(
      (f) => !oils.includes(f) && weighs(state, pairs[f], f)
    );
    if (
      oils.length > 0 &&
      foods.length > 0 &&
      foods.every((f) => isFriedRow(state, pairs[f].ground, f))
    )
      for (const f of oils) drop.add(f);
  }
  if (drop.size === 0) return { state, dropped: 0 };

  const gone = new Set(
    [...drop].flatMap((f) => (pairs[f].ground ? [pairs[f].ground] : []))
  );
  for (const item of grounded.mealItems)
    item.ingredients = item.ingredients.filter((g) => !gone.has(g));
  const keep = (_: unknown, f: number) => !drop.has(f);
  let next = 0;
  const mealItems = state.decomposition.mealItems.map((mi) => ({
    ...mi,
    ingredients: mi.ingredients.filter(() => !drop.has(next++)),
  }));
  return {
    state: {
      decomposition: { ...state.decomposition, mealItems },
      matchResults: state.matchResults
        .filter(keep)
        .map((m, i) => ({ ...m, ingredientIndex: i })),
      portionResolutions: state.portionResolutions.filter(keep),
      grounded,
    },
    dropped: drop.size,
  };
}

function selectedRow(
  state: RunState,
  ground: GroundedIngredientEstimate | null,
  f: number
) {
  const idx = /^c(\d+)$/.exec(ground?.selectedCandidateId ?? '')?.[1];
  return idx ? state.matchResults[f]?.candidates[Number(idx) - 1] : undefined;
}

function isFriedRow(
  state: RunState,
  ground: GroundedIngredientEstimate | null,
  f: number
): boolean {
  const row = selectedRow(state, ground, f);
  if (!row) return false;
  const names = `${row.prompt.nameEn ?? ''} | ${row.info.matchedName}`;
  return FRIED_ROW.test(names) && !NOT_FAT_FRIED.test(names);
}

function weighs(
  state: RunState,
  pair: ReturnType<typeof pairIngredientsWithGrounded>[number],
  f: number
): boolean {
  if (!pair.ground) return true;
  return (
    shippedEdibleGrams(
      pair.ground,
      pair.ingredient,
      state.matchResults[f],
      state.portionResolutions[f]
    ) >= MIN_FOOD_G
  );
}
