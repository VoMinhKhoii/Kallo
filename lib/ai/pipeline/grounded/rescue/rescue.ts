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
import { pairIngredientsWithGrounded } from '@/lib/ai/pipeline/resolve/verdicts';
import { nameKey } from '@/lib/core/text/name-key';
import { type RescuePart, type RunState, spliceRescue } from './splice';

export type { RescuePart } from './splice';

/** `DISH_RESCUE_ENABLED=false` turns dish rescue off. */
export function isDishRescueEnabled(): boolean {
  return readBooleanEnv('DISH_RESCUE_ENABLED', true);
}

/** Mini-meals in flight at once. */
const CONCURRENCY = 3;
/** How long the main run waits past Call 2 for the mini-meals it needs. */
const GRACE_MS = 12_000;
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

const rejected = (g: GroundedIngredientEstimate | null | undefined) =>
  g != null &&
  (g.selectedCandidateId === undefined || g.selectedCandidateId === 'none');

/** The mini-meal text for an ingredient, in the user's language. */
export function rescueMealText(
  ingredient: { rawName: string; canonicalName: string },
  language: 'en' | 'vi'
): string {
  const { rawName, canonicalName } = ingredient;
  const name =
    nameKey(rawName) === nameKey(canonicalName)
      ? rawName
      : `${rawName} (${canonicalName})`;
  return language === 'vi' ? `1 phần ${name}` : `1 portion of ${name}`;
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
  runSubMeal: (text: string) => Promise<RescuePart[] | null>;
}): {
  started: () => number[];
  close: () => void;
  apply: (
    grounded: GroundedEstimation
  ) => Promise<{ state: RunState; rescued: number } | null>;
} {
  const { decomposition, matchResults, portionResolutions } = args.state;
  const ingredients = decomposition.mealItems.flatMap((mi) => mi.ingredients);
  const limit = createLimiter(CONCURRENCY);
  const runs = new Map<number, Promise<void>>();
  const ready = new Map<number, RescuePart[]>();
  let closed = false;
  const start = (f: number) => {
    if (runs.has(f) || closed) return;
    runs.set(
      f,
      limit(async () =>
        closed
          ? null
          : args.runSubMeal(rescueMealText(ingredients[f], args.language))
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
        rescuable(ing, portionResolutions[f]) && rejected(pairs[f]?.ground)
          ? [f]
          : []
      );
      if (needed.length === 0) {
        close();
        return null;
      }
      for (const f of needed) start(f);
      let timer: ReturnType<typeof setTimeout> | undefined;
      await Promise.race([
        Promise.all(needed.map((f) => runs.get(f))),
        new Promise((resolve) => {
          timer = setTimeout(resolve, GRACE_MS);
        }),
      ]);
      clearTimeout(timer);
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
