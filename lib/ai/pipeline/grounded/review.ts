/**
 * Review Call 2's row picks against the food they stand for, after the
 * selector. `reviewPicks` is the one entry the orchestrator calls:
 * - first, a pick whose own estimate contradicts the row (a paste or powder
 *   for a prepared dish) becomes a rejection, so the dish rescue can split it;
 * - then the dish rescue splices in the parts of what Call 2 rejected;
 * - then a fried dish's separate oil row is dropped when its foods matched
 *   rows that are already fried;
 * - last, a dish the user weighed has its parts scaled to that weight
 *   (`resolve/served-mass.ts`).
 */

import type { GroundedIngredientEstimate } from '@/lib/ai/pipeline/contracts/schemas/grounded-estimation';
import type { RunState } from '@/lib/ai/pipeline/grounded/run-state';
import { classifyPureFat } from '@/lib/ai/pipeline/resolve/macros/macro-base';
import {
  selectedCandidate,
  shippedEdibleGrams,
} from '@/lib/ai/pipeline/resolve/refuse-mass';
import {
  logRawRowYields,
  scaleToServedMass,
} from '@/lib/ai/pipeline/resolve/served-mass';
import { pairIngredientsWithGrounded } from '@/lib/ai/pipeline/resolve/verdicts';
import { fold } from '@/lib/core/text/fold';
import {
  absorbedOil,
  isAlreadyFriedRow,
  isCookingFatPart,
  prepNotesAskForExtraFat,
} from '@/lib/domain/nutrition/absorbed-oil';

/**
 * Review the picks and splice in the dish rescue (`./rescue`), in that order:
 * wrong-form rows become rejections, the rescue replaces what Call 2 rejected,
 * then a fried dish's separate oil is dropped, then weighed dishes are scaled
 * to their typed weight. `changed` says the streamed dishes no longer hold;
 * `summary` is the log line.
 */
export async function reviewPicks(
  state: RunState,
  rescue: {
    apply(
      state: RunState
    ): Promise<{ state: RunState; rescued: number } | null>;
  } | null,
  /** What the user typed, so review can tell a fat they named from one Call 1 added. */
  opts: { rawInput?: string } = {}
): Promise<{
  state: RunState;
  changed: boolean;
  /** Ingredients the rescue replaced (0 when it replaced none). */
  rescued: number;
  summary: string;
}> {
  const reviewed = rejectWrongFormRows(state);
  const rescued = rescue ? await rescue.apply(reviewed.state) : null;
  const oil = dropOilInFriedRows(rescued?.state ?? reviewed.state, opts);
  logRawRowYields(oil.state);
  const served = scaleToServedMass(oil.state);
  return {
    state: served.state,
    changed:
      reviewed.rejected > 0 ||
      rescued != null ||
      oil.dropped > 0 ||
      served.scaled > 0,
    rescued: rescued?.rescued ?? 0,
    summary: `${reviewed.rejected} wrong-form rows, ${rescued?.rescued ?? 0} ingredients rescued, ${oil.dropped} oil rows dropped, ${served.scaled} weighed dishes scaled`,
  };
}

/** A wrong-form pick: the row must give more than this many times Call 2's own energy... */
const RATIO = 3;
/** ...and this many kcal more, so a small food's rounding never trips it... */
const MIN_GAP_KCAL = 100;
/**
 * ...from an estimate of at least this many kcal per 100 g. Below it Call 2
 * did not really estimate the food (a soda at 1 kcal), and the row is the
 * better number.
 */
const MIN_ESTIMATE_PER_100G = 5;

/**
 * A row Call 2 picked but whose numbers it did not believe: it matched a
 * concentrate or a dry form (miso paste for a bowl of miso soup, dry oats for
 * oat milk, a meat row for its broth) and then estimated the food the user
 * actually ate. The server ships the row × grams, so the wrong form would win
 * (a bowl of miso soup as 567 kcal). When the row gives more than three times
 * the energy Call 2 estimated for the same grams, the pick becomes a
 * rejection: the ingredient ships Call 2's own macros, and the dish rescue may
 * split it. Both sides count energy as 4P + 4C + 9F, the way the resolver
 * ships it, so a drink's alcohol (in the row's kcal, never in macros) cannot
 * trip it. Returns new state.
 */
export function rejectWrongFormRows(state: RunState): {
  state: RunState;
  rejected: number;
} {
  const grounded = structuredClone(state.grounded);
  let rejected = 0;
  pairIngredientsWithGrounded(state.decomposition, grounded).forEach(
    ({ ground }, f) => {
      const match = state.matchResults[f];
      const row = selectedCandidate(ground, match)?.nutrition;
      if (!ground || !row) return;
      const grams = shippedEdibleGrams(
        ground,
        match,
        state.portionResolutions[f]
      );
      const rowKcal =
        (grams *
          (4 * (row.proteinG ?? 0) +
            4 * (row.carbohydrateG ?? 0) +
            9 * (row.fatG ?? 0))) /
        100;
      const estimateKcal =
        4 * ground.proteinG.mid +
        4 * ground.carbohydrateG.mid +
        9 * ground.fatG.mid;
      if (grams <= 0 || (estimateKcal / grams) * 100 < MIN_ESTIMATE_PER_100G)
        return;
      if (rowKcal <= RATIO * estimateKcal) return;
      if (rowKcal - estimateKcal <= MIN_GAP_KCAL) return;
      ground.selectedCandidateId = 'none';
      ground.rejectReason = `row form: the row gives ${Math.round(rowKcal)} kcal for ${Math.round(grams)} g, the estimate ${Math.round(estimateKcal)} kcal`;
      rejected++;
    }
  );
  return { state: { ...state, grounded }, rejected };
}

/** Lighter foods are seasonings and garnish; they do not decide the dish. */
const MIN_FOOD_G = 20;

/**
 * Call 1 logs a fried dish's cooking oil as its own row. That is right when
 * the food matched a plain row (raw egg, raw shrimp), and double counting when
 * it matched a row that is already fried in it ("Egg, whole, cooked, fried").
 * A dish drops its unstated oil rows when at least one substantial food
 * matched an already-fried row and no other substantial food in the dish is
 * itself fat-cooked (its own cookingMethod implies absorbed oil, or the whole
 * dish is a stir-fry / fried rice / sauté). Returns new state.
 */
export function dropOilInFriedRows(
  state: RunState,
  opts: { rawInput?: string } = {}
): {
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
    // A cooking fat by its matched row, or by its name when unmatched.
    const fats = own.filter((f) =>
      isCookingFatPart(
        pairs[f].ingredient.rawName,
        matchedFat(state, pairs[f].ground, f)
      )
    );
    const foods = own.filter(
      (f) => !fats.includes(f) && weighs(state, pairs[f], f)
    );
    // Only the implied frying fat goes: Call 1 gives a fat row no method of
    // its own, so the dish's method says whether it was fried in. On a mixed
    // plate where only one part fries ("cá chiên giòn" in a bún cá, dish
    // method "nấu"), a pure-oil row goes only when the user never typed it:
    // Call 1 added it for the frying. A fat the user named ("mỡ hành",
    // "phết bơ", "dầu tỏi") is one they ate, and stays.
    const partFriesHere = foods.some(
      (f) =>
        isFriedRow(state, pairs[f].ground, f) &&
        absorbedOil(pairs[f].ingredient.cookingMethod, 100) > 0
    );
    const oils = fats.filter(
      (f) =>
        friedInIt(mi, pairs[f].ingredient) ||
        (partFriesHere &&
          matchedFat(state, pairs[f].ground, f)?.pureFatKind === 'oil' &&
          opts.rawInput != null &&
          !namedIn(opts.rawInput, pairs[f].ingredient))
    );
    if (foods.length === 0 || oils.length === 0) continue;
    const hasFriedFood = foods.some((f) =>
      isFriedRow(state, pairs[f].ground, f)
    );
    const otherFoodNeedsOil = foods.some(
      (f) =>
        (!isFriedRow(state, pairs[f].ground, f) &&
          foodNeedsCookingOil(mi, pairs[f].ingredient)) ||
        // "buttered toast" beside the fried eggs: the fat is the toast's.
        prepNotesAskForExtraFat(pairs[f].ingredient.prepNotes)
    );
    if (hasFriedFood && !otherFoodNeedsOil)
      for (const f of oils) {
        // An amount the user stated ("1 muỗng dầu ô liu") is what they ate.
        // A dish's count ("2 omelettes") is on the dish, not on its oil
        // (`text-checks/dish-count.ts`).
        const oil = pairs[f].ingredient;
        const stated = oil.count != null || oil.explicitMass;
        if (!stated) drop.add(f);
      }
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

/**
 * Whether a food on a plain row still takes up the dish's cooking oil. Call 1
 * gives a part its own cooking method only when it differs from the dish's
 * (rice beside fried chicken), so a part without one was cooked the dish's
 * way: the potatoes in fish and chips, the pork in an egg-and-pork omelette.
 */
function foodNeedsCookingOil(
  mi: RunState['decomposition']['mealItems'][number],
  ing: RunState['decomposition']['mealItems'][number]['ingredients'][number]
): boolean {
  const method = ing.cookingMethod || mi.cookingMethod;
  const context = [method, ...(ing.prepNotes ?? [])].filter(Boolean).join(' ');
  // A frying method takes up oil; "không dầu" / "air-fried" on the part
  // cancels it (absorbedOil reads the negation first).
  return absorbedOil(context, 100) > 0;
}

/**
 * Whether the user's own text names this part: one of its names appears there
 * as a phrase, compared folded (case, diacritics, đ) at word edges.
 */
function namedIn(
  rawInput: string,
  ing: RunState['decomposition']['mealItems'][number]['ingredients'][number]
): boolean {
  const text = ` ${fold(rawInput).replace(/[^\p{L}\p{N}]+/gu, ' ')} `;
  return [ing.rawName, ing.canonicalName, ing.nameVi].some((name) => {
    const phrase = fold(name ?? '')
      .replace(/[^\p{L}\p{N}]+/gu, ' ')
      .trim();
    return phrase.length > 0 && text.includes(` ${phrase} `);
  });
}

/** The fat row's own method, or the dish's when it has none, is a frying one. */
function friedInIt(
  mi: RunState['decomposition']['mealItems'][number],
  oil: RunState['decomposition']['mealItems'][number]['ingredients'][number]
): boolean {
  return absorbedOil(oil.cookingMethod || mi.cookingMethod, 100) > 0;
}

/** The picked row's fat class (`pureFatKind`), or undefined when unmatched. */
function matchedFat(
  state: RunState,
  ground: GroundedIngredientEstimate | null,
  f: number
): { pureFatKind: string | null } | undefined {
  const row = selectedCandidate(ground, state.matchResults[f]);
  return row?.nutrition
    ? { pureFatKind: classifyPureFat(row.nutrition) }
    : undefined;
}

function isFriedRow(
  state: RunState,
  ground: GroundedIngredientEstimate | null,
  f: number
): boolean {
  const row = selectedCandidate(ground, state.matchResults[f]);
  if (!row) return false;
  return isAlreadyFriedRow(
    row.prompt?.nameEn ?? row.info.matchedNameEn,
    row.info.rowCookingMethod,
    row.nutrition?.fatG
  );
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
      state.matchResults[f],
      state.portionResolutions[f]
    ) >= MIN_FOOD_G
  );
}
