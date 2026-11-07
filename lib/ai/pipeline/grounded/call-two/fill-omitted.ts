/**
 * Call 2 sometimes answers only part of what it was asked: a whole dish left
 * out, or some ingredients of a dish it did answer. Those foods would ship at
 * 0 g, so the part it skipped is asked for once more, on its own. A failed or
 * late re-ask keeps the answer Call 2 gave: this step only ever adds food.
 */

import type { GroundedEstimation } from '@/lib/ai/pipeline/contracts/schemas/grounded-estimation';
import type { GroundedEstimator } from '@/lib/ai/pipeline/estimator/types';
import type { MealItemWithCandidates } from '@/lib/ai/prompts/build/grounded-candidates';
import type { PromptPersonalizationContext } from '@/lib/ai/prompts/types';
import { fetchWithTimeout } from '@/lib/core/async/fetch-with-timeout';
import { nameKey } from '@/lib/core/text/name-key';

/** Too little left of the run to wait for an answer worth having. */
const MIN_BUDGET_MS = 3_000;

export interface FillOmittedArgs {
  estimator: GroundedEstimator;
  mealItems: MealItemWithCandidates[];
  originalPrompt: string;
  promptCtx: PromptPersonalizationContext;
  temperature: number;
  budgetMs: number;
  /** Meal items that already failed for a reason a re-ask would not fix. */
  skipMealItemNames?: string[];
  onAttemptComplete?: NonNullable<
    Parameters<GroundedEstimator['estimate']>[2]
  >['onAttemptComplete'];
}

/**
 * The meal items and ingredients `grounded` left out. A dish Call 2 renamed is
 * not left out when its answer still holds at least half of the dish's
 * ingredient names, and an ingredient it renamed inside a dish still counts
 * toward that dish: pairing finds both, and asking again would double them.
 */
export function omittedMealItems(
  mealItems: MealItemWithCandidates[],
  grounded: GroundedEstimation
): MealItemWithCandidates[] {
  const asked = new Set(mealItems.map((mi) => nameKey(mi.mealItem.name)));
  const answered = new Map(
    grounded.mealItems.map((item) => [
      nameKey(item.mealItemName),
      new Set(item.ingredients.map((i) => nameKey(i.ingredientName))),
    ])
  );
  const renamed = [...answered]
    .filter(([name]) => !asked.has(name))
    .map(([, ingredients]) => ingredients);

  return mealItems.flatMap((mi) => {
    const names = mi.ingredients.map((i) => nameKey(i.ingredient.rawName));
    const own = answered.get(nameKey(mi.mealItem.name));
    if (!own) {
      const covered = renamed.some(
        (set) => names.filter((n) => set.has(n)).length * 2 >= names.length
      );
      return covered ? [] : [mi];
    }
    const left = mi.ingredients.length - own.size;
    if (left <= 0) return [];
    const skipped = mi.ingredients.filter(
      (i) => !own.has(nameKey(i.ingredient.rawName))
    );
    return skipped.length > 0
      ? [{ ...mi, ingredients: skipped.slice(0, left) }]
      : [];
  });
}

export async function fillOmitted(
  grounded: GroundedEstimation,
  args: FillOmittedArgs
): Promise<GroundedEstimation> {
  const skip = new Set(args.skipMealItemNames?.map(nameKey));
  const ask = omittedMealItems(args.mealItems, grounded).filter(
    (mi) => !skip.has(nameKey(mi.mealItem.name))
  );
  if (ask.length === 0 || args.budgetMs < MIN_BUDGET_MS) return grounded;

  try {
    const again = await fetchWithTimeout(
      (signal) =>
        args.estimator
          .estimate(
            {
              originalPrompt: args.originalPrompt,
              mealItems: ask,
              userContext: args.promptCtx,
              temperature: args.temperature,
            },
            signal,
            args.onAttemptComplete
              ? { onAttemptComplete: args.onAttemptComplete }
              : {}
          )
          .then((r) => r.estimation),
      args.budgetMs,
      'grounded-nutrition-fill'
    );
    const mealItems = grounded.mealItems.map((item) => ({
      ...item,
      ingredients: [...item.ingredients],
    }));
    for (const item of again.mealItems) {
      const existing = mealItems.find(
        (m) => nameKey(m.mealItemName) === nameKey(item.mealItemName)
      );
      if (existing) existing.ingredients.push(...item.ingredients);
      else mealItems.push(item);
    }
    return { ...grounded, mealItems };
  } catch (err) {
    console.warn('[call2] re-ask for omitted foods failed', err);
    return grounded;
  }
}
