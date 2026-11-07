/**
 * Call 2 sometimes answers only part of what it was asked: a whole dish left
 * out, or some ingredients of a dish it did answer. Those foods would ship at
 * 0 g, so the part it skipped is asked for once more, on its own. A failed or
 * late re-ask keeps the answer Call 2 gave: this step only ever adds food.
 */

import type { MealDecompositionV2 } from '@/lib/ai/pipeline/contracts/schemas/decomposition-v2';
import type { GroundedEstimation } from '@/lib/ai/pipeline/contracts/schemas/grounded-estimation';
import type {
  GroundedEstimator,
  GroundedEstimatorStreamHooks,
} from '@/lib/ai/pipeline/estimator/types';
import { pairIngredientsWithGrounded } from '@/lib/ai/pipeline/resolve/verdicts';
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
  onAttemptComplete?: GroundedEstimatorStreamHooks['onAttemptComplete'];
}

/** A meal item to ask for again, and which same-name dish it belongs to. */
interface Omitted {
  item: MealItemWithCandidates;
  /** 0-based among the meal's dishes with this name. */
  occurrence: number;
}

/**
 * The meal items and ingredients `grounded` left out: what the real pairing
 * finds no estimate for, so a dish or ingredient Call 2 only renamed is not
 * asked for twice.
 */
export function omittedMealItems(
  mealItems: MealItemWithCandidates[],
  grounded: GroundedEstimation
): Omitted[] {
  const decomposition = {
    mealItems: mealItems.map((mi) => ({
      ...mi.mealItem,
      ingredients: mi.ingredients.map((i) => i.ingredient),
    })),
  } as MealDecompositionV2;
  const unpaired = new Set(
    pairIngredientsWithGrounded(decomposition, grounded)
      .filter((pair) => !pair.ground)
      .map((pair) => `${pair.mealItemIdx}:${pair.ingredientIdx}`)
  );
  const seen = new Map<string, number>();
  return mealItems.flatMap((mi, m) => {
    const name = nameKey(mi.mealItem.name);
    const occurrence = seen.get(name) ?? 0;
    seen.set(name, occurrence + 1);
    const ingredients = mi.ingredients.filter((_, i) =>
      unpaired.has(`${m}:${i}`)
    );
    return ingredients.length > 0
      ? [{ item: { ...mi, ingredients }, occurrence }]
      : [];
  });
}

/**
 * Add a re-ask's answers to the dish each was asked for: answers of one name
 * come back in the order they were asked, and go to that same-name dish.
 */
function mergeAnswers(
  grounded: GroundedEstimation,
  again: GroundedEstimation,
  ask: Omitted[]
): GroundedEstimation {
  const mealItems = grounded.mealItems.map((item) => ({
    ...item,
    ingredients: [...item.ingredients],
  }));
  const seen = new Map<string, number>();
  for (const item of again.mealItems) {
    const name = nameKey(item.mealItemName);
    const nth = seen.get(name) ?? 0;
    seen.set(name, nth + 1);
    const asked = ask.filter((o) => nameKey(o.item.mealItem.name) === name);
    const target = mealItems.filter((m) => nameKey(m.mealItemName) === name)[
      asked[nth]?.occurrence ?? nth
    ];
    if (target) target.ingredients.push(...item.ingredients);
    else mealItems.push(item);
  }
  return { ...grounded, mealItems };
}

export async function fillOmitted(
  grounded: GroundedEstimation,
  args: FillOmittedArgs
): Promise<GroundedEstimation> {
  const skip = new Set(args.skipMealItemNames?.map(nameKey));
  const ask = omittedMealItems(args.mealItems, grounded).filter(
    ({ item }) => !skip.has(nameKey(item.mealItem.name))
  );
  if (ask.length === 0 || args.budgetMs < MIN_BUDGET_MS) return grounded;

  try {
    const again = await fetchWithTimeout(
      (signal) =>
        args.estimator
          .estimate(
            {
              originalPrompt: args.originalPrompt,
              mealItems: ask.map((o) => o.item),
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
    return mergeAnswers(grounded, again, ask);
  } catch (err) {
    console.warn('[call2] re-ask for omitted foods failed', err);
    return grounded;
  }
}
