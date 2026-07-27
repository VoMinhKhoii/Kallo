import { describe, expect, it } from 'vitest';
import { vesselGramsForTier } from '@/lib/meal-utils';
import type { MealItem } from '@/lib/types/meal';

function vesselItem(overrides: Partial<MealItem> = {}): MealItem {
  return {
    id: 'soup',
    name: 'Phở bò',
    quantity: 595,
    unit: 'g',
    macros: { calories: 500, protein: 30, carbs: 60, fat: 15 },
    vessel: { family: 'bowl', tier: 2, dishClass: 'soup' },
    ...overrides,
  };
}

describe('vesselGramsForTier', () => {
  it('resolves container tiers and rejects non-container families', () => {
    expect(vesselGramsForTier(vesselItem(), 3)).toBe(850);
    expect(
      vesselGramsForTier(
        vesselItem({
          vessel: {
            family: 'piece',
            tier: 2,
            count: 1,
            kind: 'meat',
          },
        }),
        3
      )
    ).toBeUndefined();
  });
});
