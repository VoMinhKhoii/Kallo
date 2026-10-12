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
import {
  isDiscreteOilIngredient,
  statesNoOil,
} from '@/lib/domain/nutrition/absorbed-oil';

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
    ({ ingredient, ground }, f) => {
      const idx = /^c(\d+)$/.exec(ground?.selectedCandidateId ?? '')?.[1];
      const match = state.matchResults[f];
      const row = idx ? match?.candidates[Number(idx) - 1]?.nutrition : null;
      if (!ground || !row) return;
      const grams = shippedEdibleGrams(
        ground,
        ingredient,
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

/** A breading part: crumbs, batter, or flour/egg when the dish is breaded. */
const CRUMBS =
  /b[oộ]t chi[eê]n x[uù]|panko|bread ?crumbs?|v[uụ]n b[aá]nh m[iì]|b[aá]nh m[iì] v[uụ]n/i;
const BATTER = /\bbatter\b|b[oộ]t chi[eê]n gi[oò]n|b[oộ]t t[aẩ]m/i;
const FLOUR = /b[oộ]t m[iì]|\bflour\b|b[oộ]t n[aă]ng|starch/i;
const EGG = /^(?:tr[uứ]ng(?: g[aà]| v[iị]t)?|eggs?(?: wash)?|egg whites?)$/i;
/** A row that is already coated: its breading is inside it. */
const COATED_ROW = /breaded|batter|coated|crumb|chi[eê]n x[uù]|t[aẩ]m b[oộ]t/i;

type Pair = ReturnType<typeof pairIngredientsWithGrounded>[number];

/** Which of a dish's ingredients are its breading (flour and egg only when it is breaded). */
function coatingOf(
  pairs: Pair[],
  own: number[]
): Map<number, keyof typeof COATING_SHARE> {
  const name = (f: number) =>
    pairs[f].ingredient.rawName.normalize('NFC').trim();
  const breaded = own.some((f) => CRUMBS.test(name(f)) || BATTER.test(name(f)));
  const out = new Map<number, keyof typeof COATING_SHARE>();
  if (!breaded) return out;
  for (const f of own) {
    const n = name(f);
    if (CRUMBS.test(n)) out.set(f, 'crumbs');
    else if (BATTER.test(n)) out.set(f, 'batter');
    else if (FLOUR.test(n)) out.set(f, 'flour');
    else if (EGG.test(n)) out.set(f, 'egg');
  }
  // An egg that is the dish itself is food, not an egg wash.
  if (out.size === own.length) return new Map();
  return out;
}

/**
 * Call 1 logs a fried dish's cooking oil, and a breaded dish's crumbs, flour
 * and egg wash, as their own rows. That is right when the food matched a plain
 * row (raw egg, raw shrimp, pork loin), and double counting when it matched a
 * row that already holds them ("Egg, whole, cooked, fried"; "Shrimp, breaded
 * and fried"). A dish whose every food (seasonings aside) matched a fried row
 * loses its oil rows; a dish whose food matched a coated row loses its
 * breading rows. Returns new state.
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
    const coating = coatingOf(pairs, own);
    const foods = own.filter(
      (f) => !oils.includes(f) && !coating.has(f) && weighs(state, pairs[f], f)
    );
    if (foods.length === 0) continue;
    if (
      oils.length > 0 &&
      foods.every((f) => isFriedRow(state, pairs[f].ground, f))
    )
      for (const f of oils) drop.add(f);
    if (
      foods.some((f) => rowNames(state, pairs[f].ground, f).match(COATED_ROW))
    )
      for (const f of coating.keys()) drop.add(f);
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

function rowNames(
  state: RunState,
  ground: GroundedIngredientEstimate | null,
  f: number
): string {
  const row = selectedRow(state, ground, f);
  return row ? `${row.prompt.nameEn ?? ''} | ${row.info.matchedName}` : '';
}

function isFriedRow(
  state: RunState,
  ground: GroundedIngredientEstimate | null,
  f: number
): boolean {
  const names = rowNames(state, ground, f);
  return FRIED_ROW.test(names) && !NOT_FAT_FRIED.test(names);
}

/**
 * The most each breading part can weigh, as a share of the food it coats
 * (a deep-fried tonkatsu takes ~5 g flour, ~10 g egg and ~12 g crumbs per
 * 100 g of pork; these leave room for a heavy coat, never a whole egg on half
 * a cutlet).
 */
const COATING_SHARE = { crumbs: 0.25, batter: 0.3, flour: 0.1, egg: 0.15 };

/**
 * Call 2 sizes a breaded dish's crumbs, flour and egg wash by guesswork, and
 * has shipped 45–100 g of egg on half a pork cutlet. Each breading part is
 * capped at its share of the food it coats (the dish's heaviest food); its
 * macros shrink with its grams. Returns new state.
 */
export function capCoating(state: RunState): {
  state: RunState;
  capped: number;
} {
  const grounded = structuredClone(state.grounded);
  const pairs = pairIngredientsWithGrounded(state.decomposition, grounded);
  const grams = (f: number) =>
    pairs[f].ground
      ? shippedEdibleGrams(
          pairs[f].ground,
          pairs[f].ingredient,
          state.matchResults[f],
          state.portionResolutions[f]
        )
      : 0;
  let capped = 0;
  let flat = 0;
  for (const mi of state.decomposition.mealItems) {
    const own = mi.ingredients.map((_, i) => flat + i);
    flat += mi.ingredients.length;
    const coating = coatingOf(pairs, own);
    if (coating.size === 0) continue;
    const food = Math.max(
      0,
      ...own
        .filter(
          (f) =>
            !coating.has(f) &&
            !isDiscreteOilIngredient(pairs[f].ingredient.rawName)
        )
        .map(grams)
    );
    if (food <= 0) continue;
    for (const [f, kind] of coating) {
      const g = pairs[f].ground;
      const now = grams(f);
      const cap = food * COATING_SHARE[kind];
      if (!g || now <= cap || now <= 0) continue;
      const k = cap / now;
      g.grossG *= k;
      for (const field of ['proteinG', 'carbohydrateG', 'fatG'] as const) {
        const t = g[field];
        g[field] = { low: t.low * k, mid: t.mid * k, high: t.high * k };
      }
      capped++;
    }
  }
  return { state: { ...state, grounded }, capped };
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

const firstWord = (name: string) => name.split(/[ ,]/)[0]?.toLowerCase() ?? '';

/**
 * The user said a food was cooked without fat ("không dầu", "air-fried",
 * "without any oil"), but Call 2 picked a row that is already fried in it
 * ("Egg, whole, cooked, fried"). The pick moves to the same food's first plain
 * row among its candidates, at Call 2's grams, so fat the user did not use
 * is not shipped. Returns new state.
 */
export function swapFriedRowsWhenNoOil(state: RunState): {
  state: RunState;
  swapped: number;
} {
  const grounded = structuredClone(state.grounded);
  let swapped = 0;
  pairIngredientsWithGrounded(state.decomposition, grounded).forEach(
    ({ ingredient, ground, cookingMethodForIng }, f) => {
      const said = [
        cookingMethodForIng,
        ingredient.stateNote,
        ...(ingredient.prepNotes ?? []),
      ].join(' ');
      if (!ground || !statesNoOil(said)) return;
      const from = selectedRow(state, ground, f);
      if (!from || !isFriedRow(state, ground, f)) return;
      const candidates = state.matchResults[f]?.candidates ?? [];
      const food = firstWord(from.prompt.nameEn ?? from.info.matchedName);
      const to = candidates.findIndex((c) => {
        const names = `${c.prompt.nameEn ?? ''} | ${c.info.matchedName}`;
        return (
          c !== from &&
          firstWord(c.prompt.nameEn ?? c.info.matchedName) === food &&
          !FRIED_ROW.test(names)
        );
      });
      if (to < 0) return;
      // The plain row at Call 2's grams. Call 2's own adjustment is dropped,
      // not carried: it was the fat the user did not use, and keeping it would
      // take that fat off twice.
      const edibleG = ground.grossG * (1 - (ground.refusePct ?? 0) / 100);
      for (const field of ['proteinG', 'carbohydrateG', 'fatG'] as const) {
        const per100 = candidates[to].nutrition?.[field];
        if (per100 == null) continue;
        const v = (per100 * edibleG) / 100;
        ground[field] = { low: v, mid: v, high: v };
      }
      ground.selectedCandidateId = `c${to + 1}`;
      swapped++;
    }
  );
  return { state: { ...state, grounded }, swapped };
}
