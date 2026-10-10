/**
 * Dish rescue: a food Call 2 cannot match as a whole (a bánh flan with no
 * composition row, a dish logged as one ingredient) is re-run as its own
 * mini-meal, so Call 1 splits it into single foods that do match, and those
 * replace it. Measured on the Meal Arena benchmark (ttr DEV-129): +1.4 first
 * pick.
 *
 * Timing: an ingredient retrieval found no candidate for will be rejected for
 * certain, so its mini-meal starts right after matching, beside Call 2. Any
 * other ingredient Call 2 rejects (a dish named after itself, a row it
 * refused) starts once Call 2 answers: starting those speculatively would
 * run a mini-meal for nearly every plain "cơm" or banana and throw it away.
 *
 * The parts' grams are scaled to what the main run would have shipped for the
 * ingredient (`./splice`); the mini-meal supplies only the recipe split.
 */
import { readBooleanEnv } from '@/lib/ai/pipeline/config/feature-flags';
import type {
  GroundedEstimation,
  GroundedIngredientEstimate,
} from '@/lib/ai/pipeline/contracts/schemas/grounded-estimation';
import {
  classifyVerdict,
  pairIngredientsWithGrounded,
} from '@/lib/ai/pipeline/resolve/verdicts';
import { nameKey } from '@/lib/core/text/name-key';
import { type RescuePart, type RunState, spliceRescue } from './splice';
import { runRescueSubMeal, type SubMealDeps } from './sub-meal';

export type { RescuePart } from './splice';

/** `DISH_RESCUE_ENABLED=false` turns dish rescue off. */
export function isDishRescueEnabled(): boolean {
  return readBooleanEnv('DISH_RESCUE_ENABLED', true);
}

/** Mini-meals in flight at once. */
const CONCURRENCY = 3;
/** How long the main run waits past Call 2 for the mini-meals it needs. */
const GRACE_MS = 12_000;
/**
 * Never wait past this point of the whole run. The route stops at 60 s, and
 * after the pipeline the result is persisted under its own 15 s deadline
 * (`persist-analysis.ts`) before the final events, plus assembly and the
 * pre-stream DB work: 35 s keeps all of that inside the route.
 */
const RUN_DEADLINE_MS = 35_000;
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
 * "không đường") go along, so the mini-meal matches the variant the user ate.
 */
export function rescueMealText(
  ingredient: {
    rawName: string;
    canonicalName: string;
    cookingMethod?: string;
    prepNotes?: string[];
  },
  language: 'en' | 'vi'
): string {
  const { rawName, canonicalName } = ingredient;
  const name =
    nameKey(rawName) === nameKey(canonicalName)
      ? rawName
      : `${rawName} (${canonicalName})`;
  const said = words(name);
  const modifiers = [ingredient.cookingMethod, ...(ingredient.prepNotes ?? [])]
    .filter((m): m is string => !!m && !said.includes(words(m)))
    .map((m) => `, ${m}`)
    .join('');
  return language === 'vi'
    ? `1 phần ${name}${modifiers}`
    : `1 portion of ${name}${modifiers}`;
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
 * Start the certain mini-meals now. After Call 2, `apply` starts the rest for
 * what Call 2 rejected, waits up to `GRACE_MS` for all it needs, and splices
 * in those that finished; it returns null when nothing was rescued. Once
 * `apply` returns or `close` is called, no queued mini-meal starts (one
 * already running finishes in the background; the stages take no signal).
 */
export function startDishRescue(args: {
  state: Omit<RunState, 'grounded'>;
  language: 'en' | 'vi';
  /** `Date.now()` when the whole analysis started. */
  runStartedAt: number;
  /** What a mini-meal needs to run the pipeline stages (`./sub-meal`). */
  subMeal: SubMealDeps;
}): {
  started: () => number[];
  close: () => void;
  apply: (
    grounded: GroundedEstimation
  ) => Promise<{ state: RunState; rescued: number } | null>;
} {
  const { decomposition, matchResults, portionResolutions } = args.state;
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
  ingredients.forEach((ing, f) => {
    if (
      rescuable(ing, portionResolutions[f]) &&
      (matchResults[f]?.candidates.length ?? 0) === 0
    )
      start(f);
  });
  const close = () => {
    closed = true;
  };

  return {
    started: () => [...runs.keys()],
    close,
    async apply(grounded) {
      const pairs = pairIngredientsWithGrounded(decomposition, grounded);
      const needed = ingredients.flatMap((ing, f) =>
        rescuable(ing, portionResolutions[f]) &&
        rejected(pairs[f]?.ground, matchResults[f]?.candidates.length ?? 0)
          ? [f]
          : []
      );
      if (needed.length === 0) {
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
      const out = spliceRescue({ ...args.state, grounded }, parts);
      return out.rescued > 0 ? out : null;
    },
  };
}
