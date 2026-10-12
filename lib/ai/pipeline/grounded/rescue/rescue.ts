/**
 * Dish rescue: a food Call 2 cannot match as a whole (a bánh flan with no
 * composition row, a dish logged as one ingredient) is re-run as its own
 * mini-meal, so Call 1 splits it into single foods that do match, and those
 * replace it. Measured on the Meal Arena benchmark (ttr DEV-129): +1.4 first
 * pick.
 *
 * Timing: a mini-meal takes ~10 s, so each one starts as early as the signal
 * that it is needed appears, and they run side by side with the main run:
 * - right after Call 1, for a dish logged as one ingredient that names a
 *   mixed dish ("cà ri", "gyoza", "phở cuốn");
 * - right after matching, for an ingredient with no candidate (`matched`);
 * - when the candidate selector finds none fitting (`startEarly`);
 * - as Call 2 streams, the moment a dish's estimate rejects an ingredient or
 *   picks a row its own numbers contradict (`onEstimates`).
 * A mini-meal started early but not needed is thrown away. After Call 2,
 * `apply` waits at most `GRACE_MS` for the ones still needed.
 *
 * The parts' grams are scaled to what the main run would have shipped for the
 * ingredient (`./splice`); the mini-meal supplies only the recipe split.
 */

import type { IngredientV2MatchResult } from '@/lib/ai/matching/candidate';
import { readBooleanEnv } from '@/lib/ai/pipeline/config/feature-flags';
import type { MealDecompositionV2 } from '@/lib/ai/pipeline/contracts/schemas/decomposition-v2';
import type {
  GroundedEstimation,
  GroundedIngredientEstimate,
} from '@/lib/ai/pipeline/contracts/schemas/grounded-estimation';
import {
  classifyVerdict,
  pairIngredientsWithGrounded,
} from '@/lib/ai/pipeline/resolve/verdicts';
import type { PortionResolution } from '@/lib/ai/portion/types';
import { nameKey } from '@/lib/core/text/name-key';
import { isDiscreteOilIngredient } from '@/lib/domain/nutrition/absorbed-oil';
import { rejectWrongFormRows } from '../review';
import { type RescuePart, type RunState, spliceRescue } from './splice';
import { runRescueSubMeal, type SubMealDeps } from './sub-meal';

export type { RescuePart, RunState } from './splice';

/** `DISH_RESCUE_ENABLED=false` turns dish rescue off. */
export function isDishRescueEnabled(): boolean {
  return readBooleanEnv('DISH_RESCUE_ENABLED', true);
}

/** Mini-meals in flight at once. */
const CONCURRENCY = 3;
/**
 * How long the main run waits past Call 2 for the mini-meals it needs. A
 * mini-meal takes ~10 s, so one started only after Call 2 rarely makes it in
 * time and the dish keeps Call 2's own estimate; the ones started early (no
 * candidate, or the selector found none fitting) have had the whole of Call 2
 * to finish. Was 12 s: that wait, mostly for a mini-meal then dropped anyway,
 * was the slowest analyses' extra 10–12 s.
 */
const GRACE_MS = 5_000;
/**
 * Never wait past this point of the whole run. The route stops at 60 s, and
 * after the pipeline the result is persisted under its own 15 s deadline
 * (`persist-analysis.ts`) before the final events, plus assembly and the
 * pre-stream DB work: 35 s keeps all of that inside the route.
 */
const RUN_DEADLINE_MS = 35_000;
/**
 * An ingredient Call 2 sized under this is a placeholder: a dish label whose
 * parts are already listed beside it ("cà ri" next to its potato, carrot and
 * onion at 1 g). Rescuing it would scale a whole recipe into a gram and add
 * zero-gram rows, and spend a mini-meal on it.
 */
const MIN_RESCUE_G = 10;
/** Plain additions a mini-meal cannot split further. */
const NOT_A_DISH =
  /^(n[uư][oớ]c( lọc| đá)?|water|ice|đá|đường( kính)?|sugar|muối|salt|tiêu|pepper|ớt|chili|nước mắm|fish sauce)$/i;

/** Never rescued: plain additions, and what the portion resolver withheld or
 *  wants clarified (`unresolved` includes a typed zero). */
const rescuable = (
  ing: { rawName: string },
  portion?: { provenance: string }
) =>
  !NOT_A_DISH.test(ing.rawName.trim()) && portion?.provenance !== 'unresolved';

/** Rejected exactly as resolution classifies it (none, no pick, a bad id). */
const rejected = (
  g: GroundedIngredientEstimate | null | undefined,
  candidates: number
) => {
  if (g == null) return false;
  const { verdict } = classifyVerdict(g, candidates);
  return verdict === 'rejected' || verdict === 'unmatched';
};

/** A name as space-padded whole words, so " raw " is not found in " prawn ". */
const words = (text: string) =>
  ` ${nameKey(text)
    .split(/[^\p{L}\p{M}\p{N}]+/u)
    .filter(Boolean)
    .join(' ')} `;

/**
 * The mini-meal text for an ingredient, in the user's language. The cooking
 * method and preparation notes Call 1 kept beside the name ("hấp",
 * "không đường") go along, so the mini-meal matches the variant the user ate,
 * and so does Call 1's English search description when it says more than the
 * name ("Japanese-style curry sauce" for a bare "cà ri").
 */
export function rescueMealText(
  ingredient: {
    rawName: string;
    canonicalName: string;
    queryEn?: string;
    cookingMethod?: string;
    prepNotes?: string[];
  },
  language: 'en' | 'vi'
): string {
  const { rawName, canonicalName, queryEn } = ingredient;
  const name =
    nameKey(rawName) === nameKey(canonicalName)
      ? rawName
      : `${rawName} (${canonicalName})`;
  const said = words(name);
  const described =
    queryEn && !said.includes(words(queryEn)) ? ` — ${queryEn}` : '';
  const modifiers = [ingredient.cookingMethod, ...(ingredient.prepNotes ?? [])]
    .filter(
      (m): m is string =>
        !!m && !said.includes(words(m)) && !words(described).includes(words(m))
    )
    .map((m) => `, ${m}`)
    .join('');
  return language === 'vi'
    ? `1 phần ${name}${described}${modifiers}`
    : `1 portion of ${name}${described}${modifiers}`;
}

/**
 * Words that mark a mixed dish rather than one food. Used only to start a
 * mini-meal early for a dish logged as one ingredient; a miss falls back to
 * the later starts, a false hit costs one thrown-away mini-meal.
 */
const MIXED_DISH =
  /\b(?:soup|salad|curry|stew|sauce|dumplings?|rolls?|cake|pudding|pie|sandwich|burger|pizza|noodles?|ramen|pho|congee|porridge|casserole|stir[- ]?fry|fried rice|katsu|tempura|wrap|taco|burrito|omelet+e?|pancake|fritters?|gyoza|bibimbap|biryani)\b|canh|s[uú]p|ch[eè]\b|b[aá]nh|b[uú]n|ph[oở]|h[uủ] ti[eế]u|mi[eế]n|ch[aá]o|g[oỏ]i|n[oộ]m|l[aẩ]u|x[oô]i|c[aà] ri|\bkho\b|chả giò|\bnem\b|c[oơ]m (?:chi[eê]n|rang)|x[ií]u m[aạ]i|h[aá] c[aả]o/i;

/** A dish logged as one ingredient named after it, whose name says it is a mixed dish. */
function likelyMixedDish(
  dish: MealDecompositionV2['mealItems'][number],
  ing: MealDecompositionV2['mealItems'][number]['ingredients'][number]
): boolean {
  const foods = dish.ingredients.filter(
    (i) => !isDiscreteOilIngredient(i.rawName)
  );
  if (foods.length !== 1 || foods[0] !== ing) return false;
  const d = nameKey(dish.name);
  const r = nameKey(ing.rawName);
  if (!r || !(d.includes(r) || r.includes(d))) return false;
  return MIXED_DISH.test(
    [dish.name, ing.rawName, ing.canonicalName, ing.queryEn ?? ''].join(' ')
  );
}

/** Run at most `limit` tasks at once; later tasks wait their turn. */
function createLimiter(limit: number) {
  let active = 0;
  const waiting: Array<() => void> = [];
  return async <T>(task: () => Promise<T>): Promise<T> => {
    if (active >= limit) await new Promise<void>((r) => waiting.push(r));
    active++;
    try {
      return await task();
    } finally {
      active--;
      waiting.shift()?.();
    }
  };
}

/**
 * Start dish rescue right after Call 1 (see the module comment for when each
 * mini-meal starts). `matched` hands it the matching results; `apply`, after
 * Call 2, waits up to `GRACE_MS` for the mini-meals it needs and splices in
 * those that finished; it returns null when nothing was rescued. Once `apply`
 * returns or `close` is called, no queued mini-meal starts (one already
 * running finishes in the background; the stages take no signal).
 */
export function startDishRescue(args: {
  decomposition: MealDecompositionV2;
  language: 'en' | 'vi';
  /** `Date.now()` when the whole analysis started. */
  runStartedAt: number;
  /** What a mini-meal needs to run the pipeline stages (`./sub-meal`). */
  subMeal: SubMealDeps;
}): {
  started: () => number[];
  /** Matching finished: start what found no candidate. */
  matched: (
    matchResults: IngredientV2MatchResult[],
    portionResolutions: PortionResolution[]
  ) => void;
  /** Start this flat ingredient's mini-meal now (the selector found no fit). */
  startEarly: (flat: number) => void;
  /** Call 2's estimates so far: start what they reject. */
  onEstimates: (partial: GroundedEstimation) => void;
  close: () => void;
  apply: (
    grounded: GroundedEstimation
  ) => Promise<{ state: RunState; rescued: number } | null>;
} {
  const { decomposition } = args;
  let state: Omit<RunState, 'grounded'> | null = null;
  // Each ingredient with the dish's cooking method when it has none of its own.
  const ingredients = decomposition.mealItems.flatMap((mi) =>
    mi.ingredients.map((ing) => ({
      ...ing,
      cookingMethod: ing.cookingMethod ?? mi.cookingMethod,
    }))
  );
  const limit = createLimiter(CONCURRENCY);
  const runs = new Map<number, Promise<void>>();
  const ready = new Map<number, RescuePart[]>();
  let closed = false;
  const timeLeft = () => args.runStartedAt + RUN_DEADLINE_MS - Date.now();
  // Past the deadline a new mini-meal could not reach the response.
  const start = (f: number) => {
    if (runs.has(f) || closed || timeLeft() <= 0) return;
    if (
      !ingredients[f] ||
      !rescuable(ingredients[f], state?.portionResolutions[f])
    )
      return;
    runs.set(
      f,
      limit(async () =>
        // Queued work starts later; recheck when it actually begins.
        closed || timeLeft() <= 0
          ? null
          : runRescueSubMeal(
              rescueMealText(ingredients[f], args.language),
              args.subMeal
            )
      ).then(
        (parts) => {
          if (parts?.length) ready.set(f, parts);
        },
        (err) => console.warn('[rescue] mini-meal failed:', err)
      )
    );
  };
  /** The flat ingredients these estimates reject (or whose row they contradict). */
  const rejectedBy = (grounded: GroundedEstimation): number[] => {
    if (!state) return [];
    const reviewed = rejectWrongFormRows({ ...state, grounded }).state.grounded;
    const pairs = pairIngredientsWithGrounded(decomposition, reviewed);
    const matchResults = state.matchResults;
    return ingredients.flatMap((_, f) =>
      (pairs[f]?.ground?.grossG ?? 0) >= MIN_RESCUE_G &&
      rejected(pairs[f]?.ground, matchResults[f]?.candidates.length ?? 0)
        ? [f]
        : []
    );
  };

  let flat = 0;
  for (const mi of decomposition.mealItems)
    for (const ing of mi.ingredients) {
      if (likelyMixedDish(mi, ing)) start(flat);
      flat++;
    }

  const close = () => {
    closed = true;
  };

  return {
    started: () => [...runs.keys()],
    matched(matchResults, portionResolutions) {
      state = { decomposition, matchResults, portionResolutions };
      ingredients.forEach((_, f) => {
        if ((matchResults[f]?.candidates.length ?? 0) === 0) start(f);
      });
    },
    startEarly: start,
    onEstimates(partial) {
      for (const f of rejectedBy(partial)) start(f);
    },
    close,
    async apply(grounded) {
      const needed = state
        ? rejectedBy(grounded).filter((f) =>
            rescuable(ingredients[f], state?.portionResolutions[f])
          )
        : [];
      if (!state || needed.length === 0) {
        close();
        return null;
      }
      const left = timeLeft();
      if (left > 0) {
        for (const f of needed) start(f);
        let timer: ReturnType<typeof setTimeout> | undefined;
        await Promise.race([
          Promise.all(needed.map((f) => runs.get(f))),
          new Promise((resolve) => {
            timer = setTimeout(resolve, Math.min(GRACE_MS, left));
          }),
        ]);
        clearTimeout(timer);
      }
      close();
      const parts = new Map(
        needed.flatMap((f) => {
          const p = ready.get(f);
          return p ? [[f, p] as const] : [];
        })
      );
      if (parts.size === 0) return null;
      const out = spliceRescue({ ...state, grounded }, parts);
      return out.rescued > 0 ? out : null;
    },
  };
}
