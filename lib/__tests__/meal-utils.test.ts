import { describe, expect, it } from 'vitest';
import { applyVesselTierChange, MIN_DISH_GRAMS } from '@/lib/meal-utils';
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

describe('applyVesselTierChange', () => {
  it('updates the tier and scales quantity and macros by the mid-gram ratio', () => {
    const item = vesselItem();
    const [updated] = applyVesselTierChange([item], item.id, 3);
    const ratio = 850 / 595;

    expect(updated.quantity).toBe(850);
    expect(updated.macros.calories).toBeCloseTo(500 * ratio);
    expect(updated.macros.protein).toBeCloseTo(30 * ratio);
    expect(updated.macros.carbs).toBeCloseTo(60 * ratio);
    expect(updated.macros.fat).toBeCloseTo(15 * ratio);
    expect(updated.vessel?.tier).toBe(3);
  });

  it('floors a tiny rescaled quantity at MIN_DISH_GRAMS', () => {
    const [updated] = applyVesselTierChange(
      [vesselItem({ quantity: 1 })],
      'soup',
      1
    );

    expect(updated.quantity).toBe(MIN_DISH_GRAMS);
  });

  it('returns the same items array when the target has no vessel', () => {
    const items = [vesselItem({ vessel: undefined })];

    expect(applyVesselTierChange(items, 'soup', 3)).toBe(items);
  });
});
