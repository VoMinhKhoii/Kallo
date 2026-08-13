import { describe, expect, it } from 'vitest';
import type {
  DecomposedIngredientV2,
  GroundedMealItem,
} from '@/lib/ai/pipeline/schemas-v2';
import { resolveStreamingV2MealItem } from '@/lib/ai/streaming/grounded-parsers';

const triple = (mid: number) => ({ low: mid, mid, high: mid });

describe('streamed refuse resolution', () => {
  it('passes prepNotes into mass reconciliation', () => {
    const rawItem: GroundedMealItem = {
      mealItemName: 'cá kho',
      ingredients: [
        {
          ingredientName: 'khúc cá',
          grossG: 200,
          refusePct: 20,
          caloriesKcal: triple(200),
          proteinG: triple(30),
          carbohydrateG: triple(0),
          fatG: triple(8),
        },
      ],
    };
    const decomposition: DecomposedIngredientV2[] = [
      {
        rawName: 'khúc cá',
        canonicalName: 'Khúc cá',
        prepNotes: ['bỏ xương'],
      },
    ];

    const streamed = resolveStreamingV2MealItem(
      rawItem,
      decomposition,
      'kho',
      [],
      0
    );

    expect(streamed.totalGrams).toBe(200);
  });
});
