import { describe, expect, it } from 'vitest';
import {
  applyQuantityChange,
  deriveQuantityEdits,
  MIN_DISH_GRAMS,
  recalculateTotals,
} from '@/lib/meal-utils';
import type { MealItem } from '@/lib/types/meal';

const sampleItems: MealItem[] = [
  {
    id: 'item-1',
    name: 'Cơm trắng',
    quantity: 1,
    unit: 'chén',
    macros: { calories: 200, protein: 4, carbs: 44, fat: 0.4 },
  },
  {
    id: 'item-2',
    name: 'Thịt kho',
    quantity: 1,
    unit: 'phần',
    macros: { calories: 250, protein: 20, carbs: 5, fat: 16 },
  },
];

describe('recalculateTotals', () => {
  it('sums macros across all items', () => {
    const totals = recalculateTotals(sampleItems);
    expect(totals.calories).toBe(450);
    expect(totals.protein).toBe(24);
    expect(totals.carbs).toBe(49);
    expect(totals.fat).toBeCloseTo(16.4);
  });

  it('returns zeros for empty array', () => {
    const totals = recalculateTotals([]);
    expect(totals).toEqual({
      calories: 0,
      protein: 0,
      carbs: 0,
      fat: 0,
    });
  });

  it('handles single item', () => {
    const totals = recalculateTotals([sampleItems[0]]);
    expect(totals.calories).toBe(200);
    expect(totals.protein).toBe(4);
  });
});

describe('applyQuantityChange', () => {
  it('doubles macros when quantity doubles', () => {
    const updated = applyQuantityChange(sampleItems, sampleItems, 'item-1', 1);
    const rice = updated.find((i) => i.id === 'item-1')!;

    expect(rice.quantity).toBe(2);
    expect(rice.macros.calories).toBe(400);
    expect(rice.macros.protein).toBe(8);
    expect(rice.macros.carbs).toBe(88);
  });

  it('prevents quantity from going below 0', () => {
    const updated = applyQuantityChange(sampleItems, sampleItems, 'item-1', -5);
    const rice = updated.find((i) => i.id === 'item-1')!;

    expect(rice.quantity).toBe(0);
    expect(rice.macros.calories).toBe(0);
    expect(rice.macros.protein).toBe(0);
  });

  it('does not affect other items', () => {
    const updated = applyQuantityChange(sampleItems, sampleItems, 'item-1', 1);
    const meat = updated.find((i) => i.id === 'item-2')!;

    expect(meat.quantity).toBe(1);
    expect(meat.macros.calories).toBe(250);
  });

  it('scales macros proportionally for partial quantities', () => {
    // Start with quantity 2, delta -1 → back to 1
    const doubledItems = sampleItems.map((item) =>
      item.id === 'item-1'
        ? {
            ...item,
            quantity: 2,
            macros: { calories: 400, protein: 8, carbs: 88, fat: 0.8 },
          }
        : item
    );
    const updated = applyQuantityChange(
      doubledItems,
      sampleItems,
      'item-1',
      -1
    );
    const rice = updated.find((i) => i.id === 'item-1')!;

    expect(rice.quantity).toBe(1);
    expect(rice.macros.calories).toBe(200);
    expect(rice.macros.protein).toBe(4);
  });

  it('returns item unchanged if itemId not found in originals', () => {
    const updated = applyQuantityChange(sampleItems, [], 'item-1', 1);
    const rice = updated.find((i) => i.id === 'item-1')!;
    expect(rice.quantity).toBe(1); // unchanged
  });

  it('clamps gram/ml dishes at MIN_DISH_GRAMS instead of dropping to 0', () => {
    const gramItem: MealItem[] = [
      {
        id: 'g-1',
        name: 'Ức gà',
        quantity: 15,
        unit: 'g',
        macros: { calories: 30, protein: 6, carbs: 0, fat: 0.5 },
      },
    ];
    const [updated] = applyQuantityChange(gramItem, gramItem, 'g-1', -10);
    expect(updated.quantity).toBe(MIN_DISH_GRAMS); // 15 → 10, not 5
  });
});

describe('totals after quantity change', () => {
  it('updates totals correctly after increasing quantity', () => {
    const updated = applyQuantityChange(sampleItems, sampleItems, 'item-1', 1);
    const totals = recalculateTotals(updated);

    expect(totals.calories).toBe(650); // 400 + 250
    expect(totals.protein).toBe(28); // 8 + 20
  });
});

describe('deriveQuantityEdits', () => {
  it('emits an edit only for changed dishes, keyed by positional order', () => {
    const changed = applyQuantityChange(sampleItems, sampleItems, 'item-2', 1);
    expect(deriveQuantityEdits(changed, sampleItems)).toEqual([
      { mealItemOrder: 1, newGrams: 2 },
    ]);
  });

  it('returns no edits when nothing changed', () => {
    expect(deriveQuantityEdits(sampleItems, sampleItems)).toEqual([]);
  });
});
