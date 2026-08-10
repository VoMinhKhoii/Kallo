import { describe, expect, it } from 'vitest';
import { NULL_NUTRITION_VALUES } from '@/lib/ai/__tests__/test-helpers';
import type { IngredientV2MatchResult } from '@/lib/ai/matching/top-k-cascade';
import type {
  DecomposedIngredientV2,
  GroundedMealItem,
} from '@/lib/ai/pipeline/schemas-v2';
import { resolveStreamingV2MealItem } from '@/lib/ai/streaming/grounded-parsers';

// ---------------------------------------------------------------------------
// A meal item that carries its frying fat as its own ingredient row must not
// also grant that row's siblings an absorbed-oil allowance — the oil is then in
// the total twice.
//
// The reconciled path (`pipeline/nutrition.ts`) applied this from the start.
// The stream-time resolver did not: it called `resolveIngredientMacros` without
// `siblingOilPresent`, which defaults to false. So the preview showed the oil
// twice and then quietly shed it once reconciliation landed — the user watched
// the fat number fall on its own.
// ---------------------------------------------------------------------------

const triple = (mid: number) => ({ low: mid, mid, high: mid });

/** A lean potato row: the DB base carries almost no fat of its own. */
function potatoMatch(ingredientIndex: number): IngredientV2MatchResult {
  return {
    ingredientIndex,
    candidates: [
      {
        info: {
          ingredientName: 'khoai tây',
          foodCompositionId: 'fc-potato',
          matchedName: 'Khoai tây',
          similarity: 0.95,
          confidence: 'high',
          state: 'raw',
          source: 'fao',
          matchType: 'vector',
        },
        nutrition: {
          ...NULL_NUTRITION_VALUES,
          caloriesKcal: 77,
          proteinG: 2,
          carbohydrateG: 17,
          fatG: 0.1,
        },
      },
    ],
  } as IngredientV2MatchResult;
}

function oilMatch(ingredientIndex: number): IngredientV2MatchResult {
  return {
    ingredientIndex,
    candidates: [
      {
        info: {
          ingredientName: 'dầu ăn',
          foodCompositionId: 'fc-oil',
          matchedName: 'Dầu ăn',
          similarity: 0.98,
          confidence: 'high',
          state: 'raw',
          source: 'fao',
          matchType: 'vector',
        },
        nutrition: {
          ...NULL_NUTRITION_VALUES,
          caloriesKcal: 884,
          proteinG: 0,
          carbohydrateG: 0,
          fatG: 100,
        },
      },
    ],
  } as IngredientV2MatchResult;
}

/** Call 2 claims a lot of fat on the potato — far past its lean DB base. */
const friedPotatoEstimate = {
  ingredientName: 'khoai tây',
  selectedCandidateId: 'c1',
  grams: 200,
  caloriesKcal: triple(400),
  proteinG: triple(4),
  carbohydrateG: triple(34),
  fatG: triple(22),
};

const oilEstimate = {
  ingredientName: 'dầu ăn',
  selectedCandidateId: 'c1',
  grams: 25,
  caloriesKcal: triple(221),
  proteinG: triple(0),
  carbohydrateG: triple(0),
  fatG: triple(25),
};

const potatoDecomp: DecomposedIngredientV2 = {
  rawName: 'khoai tây',
  canonicalName: 'Khoai tây',
};
const oilDecomp: DecomposedIngredientV2 = {
  rawName: 'dầu ăn',
  canonicalName: 'Dầu ăn',
};

const fatOf = (
  result: ReturnType<typeof resolveStreamingV2MealItem>,
  name: string
) =>
  result.nutrition.ingredients.find((i) => i.ingredientName === name)?.fatG.mid;

describe('streamed meal items honour the discrete-oil suppression', () => {
  it('withholds the absorbed-oil allowance when the oil has its own row', () => {
    const withOil: GroundedMealItem = {
      mealItemName: 'Khoai tây chiên',
      ingredients: [friedPotatoEstimate, oilEstimate],
    };
    const withoutOil: GroundedMealItem = {
      mealItemName: 'Khoai tây chiên',
      ingredients: [friedPotatoEstimate],
    };

    const suppressed = resolveStreamingV2MealItem(
      withOil,
      [potatoDecomp, oilDecomp],
      'chiên',
      [potatoMatch(0), oilMatch(1)],
      0
    );
    const allowed = resolveStreamingV2MealItem(
      withoutOil,
      [potatoDecomp],
      'chiên',
      [potatoMatch(0)],
      0
    );

    const suppressedPotatoFat = fatOf(suppressed, 'khoai tây');
    const allowedPotatoFat = fatOf(allowed, 'khoai tây');

    expect(suppressedPotatoFat).toBeDefined();
    expect(allowedPotatoFat).toBeDefined();

    // Same potato, same claimed 22g. With a discrete oil row present the
    // allowance is gone, so the guard clamps harder against the lean base.
    expect(suppressedPotatoFat as number).toBeLessThan(
      allowedPotatoFat as number
    );

    // The oil row itself keeps its fat — it IS the fat, not a food that
    // absorbed some.
    expect(fatOf(suppressed, 'dầu ăn') as number).toBeGreaterThan(20);
  });
});
