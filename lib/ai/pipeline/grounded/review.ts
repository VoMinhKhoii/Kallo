/**
 * Review Call 2's row picks against the food they stand for, after the
 * selector. `reviewPicks` is the one entry the orchestrator calls:
 * - first, a liquid part (broth, coconut water) ships no refuse share;
 * - then a pick whose own estimate contradicts the row (a paste or powder
 *   for a prepared dish) becomes a rejection, so the dish rescue can split it;
 * - then the dish rescue splices in the parts of what Call 2 rejected;
 * - then a fried dish's separate oil row is dropped when its foods matched
 *   rows that are already fried;
 * - last, a dish the user weighed has its parts scaled to that weight
 *   (`resolve/served-mass.ts`).
 */
import type { GroundedIngredientEstimate } from '@/lib/ai/pipeline/contracts/schemas/grounded-estimation';
import type { RunState } from '@/lib/ai/pipeline/grounded/run-state';
import {
  selectedCandidate,
  shippedEdibleGrams,
} from '@/lib/ai/pipeline/resolve/refuse-mass';
import {
  isWholeLiquidPart,
  logRawRowYields,
  scaleToServedMass,
} from '@/lib/ai/pipeline/resolve/served-mass';
import { pairIngredientsWithGrounded } from '@/lib/ai/pipeline/resolve/verdicts';
import { isDiscreteOilIngredient } from '@/lib/domain/nutrition/absorbed-oil';

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
  } | null
): Promise<{
  state: RunState;
  changed: boolean;
  /** Ingredients the rescue replaced (0 when it replaced none). */
  rescued: number;
  summary: string;
}> {
  const liquid = clearLiquidRefuse(state);
  const reviewed = rejectWrongFormRows(liquid.state);
  const rescued = rescue ? await rescue.apply(reviewed.state) : null;
  // The rescue's parts come from their own Call 2, so they get the same check.
  const rescuedLiquid = rescued ? clearLiquidRefuse(rescued.state) : null;
  const oil = dropOilInFriedRows(rescuedLiquid?.state ?? reviewed.state);
  logRawRowYields(oil.state);
  const served = scaleToServedMass(oil.state);
  return {
    state: served.state,
    changed:
      liquid.cleared > 0 ||
      (rescuedLiquid?.cleared ?? 0) > 0 ||
      reviewed.rejected > 0 ||
      rescued != null ||
      oil.dropped > 0 ||
      served.scaled > 0,
    rescued: rescued?.rescued ?? 0,
    summary: `${reviewed.rejected} wrong-form rows, ${rescued?.rescued ?? 0} ingredients rescued, ${oil.dropped} oil rows dropped, ${served.scaled} weighed dishes scaled`,
  };
}

/**
 * A liquid part has nothing to throw away: broth made from bones and coconut
 * water drunk from the shell are all eaten. Call 2 is told so, but now and then
 * names the bone or shell anyway (rib broth and coconut water at 60%, 1 in 3
 * replays), which cuts the liquid's grams. By the same liquid names the
 * dish-weight scaling reads, when the whole part is the liquid, such a part
 * ships 0% refuse with kind none. Returns new state.
 */
export function clearLiquidRefuse(state: RunState): {
  state: RunState;
  cleared: number;
} {
  const grounded = structuredClone(state.grounded);
  let cleared = 0;
  for (const { ingredient, ground } of pairIngredientsWithGrounded(
    state.decomposition,
    grounded
  )) {
    if (!ground || !isWholeLiquidPart(ingredient)) continue;
    if (ground.refusePct === 0 && ground.refuseKind === 'none') continue;
    console.info('[v2-pipeline] liquid_refuse_cleared', {
      ingredient: ingredient.rawName,
      refuseKind: ground.refuseKind,
      refusePct: ground.refusePct,
    });
    ground.refusePct = 0;
    ground.refuseKind = 'none';
    cleared++;
  }
  return cleared > 0
    ? { state: { ...state, grounded }, cleared }
    : { state, cleared };
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
 * it matched a row that is already fried in it ("Egg, whole, cooked, fried").
 * A dish whose every food (seasonings aside) matched a fried row loses its oil
 * rows. Returns new state.
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
    if (foods.length === 0) continue;
    if (
      oils.length > 0 &&
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

function isFriedRow(
  state: RunState,
  ground: GroundedIngredientEstimate | null,
  f: number
): boolean {
  const row = selectedCandidate(ground, state.matchResults[f]);
  const names = row
    ? `${row.prompt.nameEn ?? ''} | ${row.info.matchedName}`
    : '';
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
      state.matchResults[f],
      state.portionResolutions[f]
    ) >= MIN_FOOD_G
  );
}
