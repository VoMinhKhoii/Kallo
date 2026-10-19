import { describe, expect, it } from 'vitest';
import type { DecomposedIngredientV2 } from '@/lib/ai/pipeline/contracts/schemas/decomposition-v2';
import type { GroundedMealItem } from '@/lib/ai/pipeline/contracts/schemas/grounded-estimation';
import { resolveStreamingV2MealItem } from '@/lib/ai/streaming/grounded-parsers';

const triple = (mid: number) => ({ low: mid, mid, high: mid });

describe('streamed refuse resolution', () => {
  it("ships Call 2's refuse even when a prep note names a boneless form", () => {
    // No name or prep-note keyword overrides the model's share any more.
    const rawItem: GroundedMealItem = {
      mealItemName: 'cá kho',
      ingredients: [
        {
          ingredientName: 'khúc cá',
          grossG: 200,
          refuseKind: 'bone',
          refusePct: 20,
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

    expect(streamed.totalGrams).toBe(160);
  });
});
