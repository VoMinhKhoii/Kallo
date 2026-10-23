import { describe, expect, it } from 'vitest';
import type {
  PersistedIngredient,
  PersistedMeal,
  PersistedMealItemGroup,
} from '@/lib/actions/meals/types';
import type { NutritionValues } from '@/lib/ai/types/nutrition-values';
import type { MealItem } from '@/lib/core/types/meal';
import { deriveQuantityEdits } from '@/lib/domain/meals/quantity-recalculation';
import {
  findDish,
  floorOf,
  removesOnMinus,
  servingsMinusDisabled,
  servingsOf,
  setDishGrams,
  stepAmount,
  stepServings,
  stepWhole,
  sumTotals,
} from '../meal-edit-draft';
import {
  draftFromPersisted,
  draftFromStaged,
  persistedEditFrom,
  stagedItemsFrom,
} from '../meal-edit-sources';

const nutrition = (kcal?: number, protein?: number) =>
  ({
    caloriesKcal: kcal ?? null,
    proteinG: protein ?? null,
    carbohydrateG: null,
    fatG: null,
  }) as unknown as NutritionValues;

function ing(
  id: string,
  grams: number | null,
  kcal?: number,
  protein?: number,
  unit = 'g'
): PersistedIngredient {
  return {
    id,
    ingredientName: id,
    foodCompositionId: null,
    estimatedGrams: grams,
    userFacingUnit: unit,
    cookingMethod: null,
    matchConfidence: null,
    nutrition: nutrition(kcal, protein),
  };
}

const dish = (
  order: number,
  ingredients: PersistedIngredient[]
): PersistedMealItemGroup => ({
  name: `dish ${order}`,
  order,
  ingredients,
  nutrition: nutrition(),
});

const meal = (groups: PersistedMealItemGroup[]): PersistedMeal => ({
  id: 'm',
  rawInput: 'lunch',
  mealSlot: null,
  confidenceOverall: null,
  loggedAt: '2026-10-23T12:00:00Z',
  nutrition: nutrition(),
  mealItemGroups: groups,
  entryMode: 'precise',
  alcoholG: null,
  cheatSliders: null,
  share: null,
});

const item = (id: string, grams: number, kcal: number): MealItem => ({
  id,
  name: id,
  quantity: grams,
  unit: 'g',
  macros: { calories: kcal, protein: 10, carbs: 20, fat: 5 },
});

const bowl = meal([
  dish(0, [ing('rice', 200, 260, 5), ing('chicken', 150, 250, 40)]),
  dish(1, [ing('latte', 350, 190, 12, 'ml')]),
]);

const noRepoint = <T>(v: T) => v;

describe('servings', () => {
  it('doubles a dish and scales every part with it', () => {
    const d = stepServings(
      stepServings(draftFromPersisted(bowl), '0:dish 0', 1),
      '0:dish 0',
      1
    );
    expect(findDish(d, '0:dish 0')?.grams).toBe(700);
    expect(sumTotals(d.dishes).kcal).toBe(2 * 510 + 190);
    expect(sumTotals(d.dishes).protein).toBe(2 * 45 + 12);
  });

  it('steps from an off-step amount to the NEAREST half, both ways', () => {
    const d = draftFromPersisted(bowl); // dish 0 is 350 g
    const off = setDishGrams(d, '0:dish 0', 360);
    expect(
      servingsOf(findDish(stepServings(off, '0:dish 0', -1), '0:dish 0')!)
    ).toBe(1);
    const high = setDishGrams(d, '0:dish 0', 516.25); // 1.475×
    expect(
      servingsOf(findDish(stepServings(high, '0:dish 0', 1), '0:dish 0')!)
    ).toBe(1.5);
  });

  it('removes a dish at half a serving on a saved meal, never the last one', () => {
    const half = stepServings(draftFromPersisted(bowl), '1:dish 1', -1);
    expect(removesOnMinus(half, findDish(half, '1:dish 1')!)).toBe(true);
    expect(
      findDish(stepServings(half, '1:dish 1', -1), '1:dish 1')
    ).toBeUndefined();

    const only = stepServings(
      draftFromPersisted(meal([bowl.mealItemGroups[1]])),
      '1:dish 1',
      -1
    );
    expect(servingsMinusDisabled(only, findDish(only, '1:dish 1')!)).toBe(true);
  });

  it('a small dish can still be removed once it hits the floor', () => {
    const m = meal([dish(0, [ing('rice', 200)]), dish(1, [ing('sauce', 15)])]);
    const d = stepServings(draftFromPersisted(m), '1:dish 1', -1);
    expect(findDish(d, '1:dish 1')?.grams).toBe(10);
    expect(
      findDish(stepServings(d, '1:dish 1', -1), '1:dish 1')
    ).toBeUndefined();
  });

  it('a dish with no grams can be removed but not grown', () => {
    const m = meal([
      dish(0, [ing('rice', 200)]),
      dish(1, [ing('legacy', null, 50)]),
    ]);
    const d = draftFromPersisted(m);
    expect(
      servingsOf(findDish(stepServings(d, '1:dish 1', 1), '1:dish 1')!)
    ).toBe(1);
    expect(
      findDish(stepServings(d, '1:dish 1', -1), '1:dish 1')
    ).toBeUndefined();
  });
});

describe('amount and floor', () => {
  it('steps ten at a time and holds the floor', () => {
    const d = draftFromPersisted(meal([dish(0, [ing('salt', 15)])]));
    expect(findDish(stepAmount(d, '0:dish 0', 1), '0:dish 0')?.grams).toBe(25);
    expect(findDish(stepAmount(d, '0:dish 0', -1), '0:dish 0')?.grams).toBe(10);
  });

  it('a dish logged under the floor opens and saves as logged', () => {
    const m = meal([
      dish(0, [ing('rice', 200, 260)]),
      dish(1, [ing('butter', 5, 36)]),
    ]);
    const d = draftFromPersisted(m);
    expect(findDish(d, '1:dish 1')?.grams).toBe(5);
    expect(floorOf(findDish(d, '1:dish 1')!)).toBe(5);
    expect(sumTotals(d.dishes).kcal).toBe(296);
    expect(persistedEditFrom(m, d).edits).toEqual([]);
  });

  it('reads in ml only when every weighed part is ml', () => {
    const d = draftFromPersisted(bowl);
    expect(findDish(d, '0:dish 0')?.unit).toBe('g');
    expect(findDish(d, '1:dish 1')?.unit).toBe('ml');
  });
});

describe('whole meal', () => {
  it('scales every dish and stops at half a meal', () => {
    const d = stepWhole(draftFromPersisted(bowl), 1);
    expect(d.whole).toBe(1.5);
    expect(findDish(d, '0:dish 0')?.grams).toBe(525);
    expect(stepWhole(stepWhole(stepWhole(d, -1), -1), -1).whole).toBe(0.5);
  });

  it('down then up restores a dish that hit the floor', () => {
    const m = meal([dish(0, [ing('rice', 200)]), dish(1, [ing('sauce', 15)])]);
    const down = stepWhole(draftFromPersisted(m), -1);
    expect(findDish(down, '1:dish 1')?.grams).toBe(10);
    const back = stepWhole(down, 1);
    expect(findDish(back, '1:dish 1')?.grams).toBe(15);
    expect(persistedEditFrom(m, back).edits).toEqual([]);
  });
});

describe('nulls are not zero', () => {
  it('a macro no part carries stays null', () => {
    const d = draftFromPersisted(meal([dish(0, [ing('x', 100)])]));
    expect(sumTotals(d.dishes).kcal).toBeNull();
  });

  it('a part with no grams keeps its nutrition as the dish scales', () => {
    const m = meal([
      dish(0, [ing('weighed', 100, 100), ing('legacy', null, 50)]),
    ]);
    const d = stepServings(
      stepServings(draftFromPersisted(m), '0:dish 0', 1),
      '0:dish 0',
      1
    );
    expect(sumTotals(d.dishes).kcal).toBe(250);
  });
});

describe('dish identity', () => {
  it('keeps two dishes that share an order apart', () => {
    const twin = (name: string, id: string): PersistedMealItemGroup => ({
      ...dish(0, [ing(id, 100, 100)]),
      name,
    });
    const m = meal([twin('Rice', 'rice'), twin('Soup', 'soup')]);
    const d = stepServings(
      stepServings(draftFromPersisted(m), '0:Rice', -1),
      '0:Rice',
      -1
    );
    expect(findDish(d, '0:Rice')).toBeUndefined();
    expect(findDish(d, '0:Soup')?.grams).toBe(100);
    expect(persistedEditFrom(m, d)).toEqual({ edits: [], removeIds: ['rice'] });
  });
});

describe('zero-gram rows', () => {
  it('hold like missing ones, in the preview and the payload', () => {
    const m = meal([dish(0, [ing('weighed', 100, 100), ing('zero', 0, 50)])]);
    const d = stepServings(
      stepServings(draftFromPersisted(m), '0:dish 0', 1),
      '0:dish 0',
      1
    );
    expect(sumTotals(d.dishes).kcal).toBe(250);
    expect(persistedEditFrom(m, d).edits).toEqual([
      { id: 'weighed', newGrams: 200 },
    ]);
  });
});

describe('saved payload', () => {
  it('sends nothing when nothing changed', () => {
    expect(persistedEditFrom(bowl, draftFromPersisted(bowl))).toEqual({
      edits: [],
      removeIds: [],
    });
  });

  it('sends every weighed row of a resized dish and the ids of a removed one', () => {
    let d = stepServings(draftFromPersisted(bowl), '0:dish 0', 1);
    d = stepServings(stepServings(d, '1:dish 1', -1), '1:dish 1', -1);
    expect(persistedEditFrom(bowl, d)).toEqual({
      edits: [
        { id: 'rice', newGrams: 300 },
        { id: 'chicken', newGrams: 225 },
      ],
      removeIds: ['latte'],
    });
  });

  it('keeps a tiny part positive', () => {
    const m = meal([dish(0, [ing('rice', 200), ing('salt', 0.1)])]);
    const out = persistedEditFrom(
      m,
      stepServings(draftFromPersisted(m), '0:dish 0', -1)
    );
    expect(out.edits).toEqual([{ id: 'rice', newGrams: 100 }]);
  });
});

describe('unsaved', () => {
  const staged = [item('a', 400, 600), item('b', 100, 200)];

  it('scales off the item as staged and cannot remove a dish', () => {
    const d = draftFromStaged(staged, staged);
    expect(d.canRemove).toBe(false);
    const half = stepServings(d, 'a', -1);
    expect(servingsMinusDisabled(half, findDish(half, 'a')!)).toBe(true);
    const out = stagedItemsFrom(stepServings(d, 'a', 1), staged, noRepoint);
    expect(out[0].quantity).toBe(600);
    expect(out[0].macros.calories).toBe(900);
    expect(out[1]).toBe(staged[1]);
  });

  it('untouched items come back exactly as they went in', () => {
    const odd = [item('a', 5, 36), item('b', 12.5, 20)];
    const out = stagedItemsFrom(
      stepAmount(draftFromStaged(odd, odd), 'b', 1),
      odd,
      noRepoint
    );
    expect(out[0]).toBe(odd[0]);
    expect(out[1].quantity).toBe(23);
    expect(out[1].macros.calories).toBeCloseTo((20 * 23) / 12.5, 9);
  });

  it('stepping back to the staged amount restores it exactly', () => {
    const odd = [item('b', 12.5, 20)];
    const up = stagedItemsFrom(
      stepAmount(draftFromStaged(odd, odd), 'b', 1),
      odd,
      noRepoint
    );
    expect(up[0].quantity).toBe(23);
    // Reopen on the edited card: 1.84× → 1.5× → 1×.
    const back = stagedItemsFrom(
      stepServings(stepServings(draftFromStaged(up, odd), 'b', -1), 'b', -1),
      up,
      noRepoint
    );
    expect(back[0].quantity).toBe(12.5);
    expect(back[0].macros.calories).toBe(20);
    expect(deriveQuantityEdits(back, odd)).toEqual([]);
  });

  it('an already-edited item reopens at its current grams', () => {
    const edited = [item('a', 500, 750), staged[1]];
    const d = draftFromStaged(edited, staged);
    expect(findDish(d, 'a')?.grams).toBe(500);
    expect(servingsOf(findDish(d, 'a')!)).toBe(1.25);
    expect(sumTotals(d.dishes).kcal).toBe(950);
  });
});
