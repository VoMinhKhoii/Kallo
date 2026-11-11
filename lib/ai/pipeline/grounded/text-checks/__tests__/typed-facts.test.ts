import { describe, expect, it, vi } from 'vitest';
import {
  RESCUE_PART_PORTION,
  RESCUE_TYPED_PART_PORTION,
} from '@/lib/ai/pipeline/grounded/rescue/splice';
import type { PipelineResult } from '@/lib/ai/types/result';
import { holdToTypedCalories, markTypedParts } from '../typed-facts';

vi.spyOn(console, 'info').mockImplementation(() => {});
vi.spyOn(console, 'warn').mockImplementation(() => {});

const triple = (mid: number) => ({ low: mid * 0.9, mid, high: mid * 1.1 });
const part = (name: string, grams: number, kcal: number, fat: number) => ({
  ingredientName: name,
  foodCompositionId: null,
  estimatedGrams: grams,
  rawEquivalentGrams: grams,
  cookingMethod: null,
  userFacingUnit: null,
  matchConfidence: null,
  boundedNutrition: { caloriesKcal: triple(kcal), fatG: triple(fat) },
  displayedNutrition: { caloriesKcal: kcal, fatG: fat },
});
const item = (name: string, ...parts: ReturnType<typeof part>[]) => ({
  name,
  ingredients: parts,
  boundedNutrition: {
    caloriesKcal: triple(
      parts.reduce((t, p) => t + p.displayedNutrition.caloriesKcal, 0)
    ),
    fatG: triple(parts.reduce((t, p) => t + p.displayedNutrition.fatG, 0)),
  },
  displayedNutrition: {
    caloriesKcal: parts.reduce(
      (t, p) => t + p.displayedNutrition.caloriesKcal,
      0
    ),
    fatG: parts.reduce((t, p) => t + p.displayedNutrition.fatG, 0),
  },
});
const result = (...items: ReturnType<typeof item>[]) =>
  ({
    mealItems: items,
    mealSlot: null,
    confidenceOverall: 'medium',
    boundedNutrition: {
      caloriesKcal: triple(
        items.reduce((t, i) => t + i.displayedNutrition.caloriesKcal, 0)
      ),
      fatG: triple(items.reduce((t, i) => t + i.displayedNutrition.fatG, 0)),
    },
    displayedNutrition: {
      caloriesKcal: items.reduce(
        (t, i) => t + i.displayedNutrition.caloriesKcal,
        0
      ),
      fatG: items.reduce((t, i) => t + i.displayedNutrition.fatG, 0),
    },
    unmatchedIngredients: [],
  }) as unknown as PipelineResult;

describe('holdToTypedCalories', () => {
  it('sets a dish to the calories typed for it and keeps its grams', () => {
    const before = result(
      item(
        'Sữa chua topping',
        part('Sữa chua', 75, 40, 2),
        part('Mứt', 10, 6, 0)
      ),
      item('Chuối', part('Chuối', 100, 90, 0.3))
    );
    const held = holdToTypedCalories(before, [
      { name: 'sữa chua topping', statedKcal: 160 },
      { name: 'Chuối' },
    ]);
    const [yogurt, banana] = held.mealItems;
    expect(yogurt.displayedNutrition.caloriesKcal).toBeCloseTo(160);
    expect(yogurt.ingredients[0].estimatedGrams).toBe(75);
    // The parts keep their split and the macros follow the calories.
    expect(yogurt.ingredients[0].displayedNutrition.caloriesKcal).toBeCloseTo(
      (160 * 40) / 46
    );
    expect(yogurt.displayedNutrition.fatG).toBeCloseTo((2 * 160) / 46);
    expect(yogurt.boundedNutrition.caloriesKcal?.mid).toBeCloseTo(160);
    expect(banana).toBe(before.mealItems[1]);
    // The meal total moves by the same amount.
    expect(held.displayedNutrition.caloriesKcal).toBeCloseTo(250);
    expect(held.boundedNutrition.caloriesKcal?.high).toBeCloseTo(275);
  });

  it('sets one food of a dish to its typed calories and leaves the others', () => {
    const before = result(
      item(
        'Bánh mì trứng',
        part('Bánh mì', 80, 210, 2),
        part('Trứng', 100, 150, 10)
      )
    );
    const dishes = [
      { name: 'Bánh mì trứng', ingredients: [{ statedKcal: 300 }, {}] },
    ];
    const held = holdToTypedCalories(before, dishes);
    const [bread, egg] = held.mealItems[0].ingredients;
    expect(bread.displayedNutrition.caloriesKcal).toBeCloseTo(300);
    expect(bread.estimatedGrams).toBe(80);
    expect(egg).toBe(before.mealItems[0].ingredients[1]);
    expect(held.mealItems[0].displayedNutrition.caloriesKcal).toBeCloseTo(450);
    expect(held.displayedNutrition.caloriesKcal).toBeCloseTo(450);
    const marked = markTypedParts(
      held,
      {
        isFood: true,
        mealSlot: null,
        mealItems: [
          {
            name: 'Bánh mì trứng',
            cookingMethod: 'ốp la',
            ingredients: [
              { rawName: 'Bánh mì', canonicalName: 'Bánh mì', statedKcal: 300 },
              { rawName: 'Trứng', canonicalName: 'Trứng' },
            ],
          },
        ],
      },
      [undefined, undefined]
    );
    expect(marked.mealItems[0].ingredients.map((i) => i.typedAmount)).toEqual([
      'kcal',
      undefined,
    ]);
  });

  it('leaves a meal with no typed calories, a renamed dish and a 0 kcal dish alone', () => {
    const before = result(item('Trà đá', part('Trà', 200, 0, 0)));
    expect(holdToTypedCalories(before, [{ name: 'Trà đá' }])).toBe(before);
    expect(
      holdToTypedCalories(before, [{ name: 'Nước', statedKcal: 30 }])
    ).toBe(before);
    expect(
      holdToTypedCalories(before, [{ name: 'Trà đá', statedKcal: 30 }])
    ).toBe(before);
  });
});

describe('markTypedParts', () => {
  const pinned = { provenance: 'explicit_user_mass', grams: { mid: 100 } };
  const free = { provenance: 'llm_range', grams: null };
  const dish = (name: string, n: number, extra = {}) => ({
    name,
    cookingMethod: 'cooked',
    ingredients: Array.from({ length: n }, (_, i) => ({
      rawName: `p${i}`,
      canonicalName: `p${i}`,
    })),
    ...extra,
  });
  const typedOf = (r: PipelineResult) =>
    r.mealItems.map((mi) => mi.ingredients.map((i) => i.typedAmount != null));

  it('marks a weighed part, and every part of a weighed or calorie-typed dish', () => {
    const before = result(
      item('Mì', part('mì', 80, 380, 14), part('rau', 100, 40, 0)),
      item('Phở', part('bánh phở', 200, 220, 1), part('bò', 60, 90, 3)),
      item('Sữa chua', part('sữa chua', 100, 160, 3))
    );
    const marked = markTypedParts(
      before,
      {
        isFood: true,
        mealSlot: null,
        mealItems: [
          dish('Mì', 2),
          dish('Phở', 2, { servedMassG: 600 }),
          dish('Sữa chua', 1, { statedKcal: 160 }),
        ],
      } as never,
      [free, pinned, free, free, free] as never
    );
    expect(typedOf(marked)).toEqual([[false, true], [true, true], [true]]);
    // Only a dish typed as a whole says so: the hold looks for it in the read
    // as one food, and for a part weighed on its own as itself.
    expect(marked.mealItems.map((mi) => mi.typedWhole)).toEqual([
      undefined,
      'grams',
      'kcal',
    ]);
  });

  it('marks the foods the rescue split a weighed part into', () => {
    const before = result(
      item(
        'Cà ri gà',
        part('gà', 150, 250, 9),
        part('nước cốt dừa', 80, 150, 15),
        part('cơm', 150, 195, 0)
      )
    );
    const marked = markTypedParts(
      before,
      {
        isFood: true,
        mealSlot: null,
        mealItems: [dish('Cà ri gà', 3)],
      } as never,
      [
        RESCUE_TYPED_PART_PORTION,
        RESCUE_TYPED_PART_PORTION,
        RESCUE_PART_PORTION,
      ]
    );
    expect(typedOf(marked)).toEqual([[true, true, false]]);
  });

  it('marks a whole dish whose parts do not line up with Call 1', () => {
    const before = result(item('Mì', part('mì', 80, 380, 14)));
    const marked = markTypedParts(
      before,
      { isFood: true, mealSlot: null, mealItems: [dish('Mì', 2)] } as never,
      [free, free] as never
    );
    expect(typedOf(marked)).toEqual([[true]]);
  });
});
