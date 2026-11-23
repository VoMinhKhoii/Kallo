import { describe, expect, it } from 'vitest';
import type {
  DecomposedDishV2,
  DishCount,
  MealDecompositionV2,
} from '@/lib/ai/pipeline/contracts/schemas/decomposition-v2';
import { holdDishCountsToText } from '../dish-count';

type Part = [name: string, count?: number, unitToken?: string];

const dish = (
  extra: Partial<DecomposedDishV2>,
  ...parts: Part[]
): DecomposedDishV2 => ({
  name: 'dish',
  cookingMethod: 'fried',
  ...extra,
  ingredients: parts.map(([rawName, count, unitToken]) => ({
    rawName,
    canonicalName: rawName,
    ...(count != null ? { count } : {}),
    ...(unitToken ? { unitToken } : {}),
  })),
});

/** Run the check on one dish and return it. */
function held(text: string, d: DecomposedDishV2): DecomposedDishV2 {
  const meal: MealDecompositionV2 = {
    isFood: true,
    mealSlot: null,
    mealItems: [d],
  };
  holdDishCountsToText(meal, text);
  return meal.mealItems[0];
}

const counts = (d: DecomposedDishV2) =>
  d.ingredients.map((i) => [i.count ?? null, i.unitToken ?? null]);
const count = (n: number, unitToken: string): DishCount => ({
  count: n,
  unitToken,
});

describe('holdDishCountsToText', () => {
  it("keeps Call 1's dish count and strips the copies its parts carry", () => {
    const d = held(
      '2 burgers',
      dish(
        { dishCount: count(2, 'burger') },
        ['bun', 2, 'burger'],
        ['patty', 2, 'burger'],
        ['oil', 2, 'burger']
      )
    );
    expect(d.dishCount).toEqual(count(2, 'burger'));
    expect(counts(d)).toEqual([
      [null, null],
      [null, null],
      [null, null],
    ]);
  });

  it('lifts a count every food carries in the same unit to the dish', () => {
    const d = held(
      '3 bánh xèo',
      dish({}, ['bột gạo', 3, 'bánh xèo'], ['tôm', 3, 'bánh xèo'], ['dầu ăn'])
    );
    expect(d.dishCount).toEqual(count(3, 'bánh xèo'));
    expect(counts(d).every(([c]) => c === null)).toBe(true);
  });

  it("lifts a count in the dish's vessel word carried by two foods, and keeps a part's own count", () => {
    // "2 tô phở thêm 1 trứng": the egg's 1 is its own.
    const d = held(
      '2 tô phở thêm 1 trứng',
      dish(
        { vesselToken: 'tô' },
        ['bánh phở', 2, 'tô'],
        ['thịt bò', 2, 'tô'],
        ['nước dùng', 2, 'tô'],
        ['trứng', 1, 'quả']
      )
    );
    expect(d.dishCount).toEqual(count(2, 'tô'));
    expect(counts(d)).toEqual([
      [null, null],
      [null, null],
      [null, null],
      [1, 'quả'],
    ]);
  });

  it('lifts half a vessel written on one food when no other food has an amount', () => {
    const d = held(
      '1/2 chén bò kho',
      dish(
        { name: 'bò kho', vesselToken: 'chén' },
        ['thịt bò', 0.5, 'chén'],
        ['sả'],
        ['dầu ăn']
      )
    );
    expect(d.dishCount).toEqual(count(0.5, 'chén'));
    expect(d.ingredients[0].count).toBeUndefined();
  });

  it("keeps a lone vessel measure as its part's amount beside other typed amounts", () => {
    const d = held(
      'bún chả 100g thịt, nửa chén nước mắm',
      dish(
        { vesselToken: 'chén' },
        ['bún'],
        ['thịt', 100, 'g'],
        ['nước mắm', 0.5, 'chén']
      )
    );
    expect(d.dishCount).toBeUndefined();
    expect(d.ingredients[2].count).toBe(0.5);
  });

  it('keeps part counts of a dish built from typed amounts (part-count traps)', () => {
    // Fried rice from "2 bát cơm nguội + 2 quả trứng": both are the parts' own.
    const fried = held(
      'cơm chiên 2 bát cơm nguội + 2 quả trứng',
      dish(
        { name: 'cơm chiên' },
        ['cơm', 2, 'bát'],
        ['trứng', 2, 'quả'],
        ['dầu ăn']
      )
    );
    expect(fried.dishCount).toBeUndefined();
    expect(counts(fried)).toEqual([
      [2, 'bát'],
      [2, 'quả'],
      [null, null],
    ]);
    // "tô phở ăn nửa bánh": the half is the noodles', not the bowl's.
    const pho = held(
      'tô phở ăn nửa bánh',
      dish(
        { vesselToken: 'tô' },
        ['bánh phở', 0.5, 'bánh'],
        ['thịt bò'],
        ['nước dùng']
      )
    );
    expect(pho.dishCount).toBeUndefined();
    expect(pho.ingredients[0].count).toBe(0.5);
  });

  it('keeps equal counts typed for only some foods as typed', () => {
    const d = held(
      'salad 2 quả trứng, 2 quả cà chua và rau',
      dish({}, ['trứng', 2, 'quả'], ['cà chua', 2, 'quả'], ['rau xà lách'])
    );
    expect(d.dishCount).toBeUndefined();
    expect(d.ingredients[0].count).toBe(2);
  });

  it('keeps shared spoon and gram measures as each part’s own amount', () => {
    for (const unit of ['muỗng', 'tablespoon', 'cups', 'ml', 'g', 'lạng']) {
      const d = held(
        `1 ${unit} dầu, 1 ${unit} nước mắm`,
        dish({}, ['dầu ăn', 1, unit], ['nước mắm', 1, unit], ['rau', 1, unit])
      );
      expect(d.dishCount).toBeUndefined();
      expect(d.ingredients[1].count).toBe(1);
    }
  });

  it("strips an oil that only copies a one-food dish's count", () => {
    // "2 omelettes": the egg's count is typed (and mirrored on the dish), the
    // oil only copies it.
    const d = held(
      '2 omelettes',
      dish({}, ['egg', 2, 'omelette'], ['oil', 2, 'omelette'])
    );
    expect(d.dishCount).toEqual(count(2, 'omelette'));
    expect(counts(d)).toEqual([
      [2, 'omelette'],
      [null, null],
    ]);
  });

  it('puts a one-food dish count on the food too, and keeps it on the dish for a rescue', () => {
    const d = held(
      '1/2 chén cơm',
      dish(
        { name: 'cơm', vesselToken: 'chén', dishCount: count(0.5, 'chén') },
        ['cơm']
      )
    );
    expect(d.dishCount).toEqual(count(0.5, 'chén'));
    expect(counts(d)).toEqual([[0.5, 'chén']]);
  });

  it("replaces a one-food dish's per-vessel 1 with the dish's count", () => {
    const d = held(
      '2 chén cơm',
      dish({ name: 'cơm', vesselToken: 'chén', dishCount: count(2, 'chén') }, [
        'cơm',
        1,
        'chén',
      ])
    );
    expect(counts(d)).toEqual([[2, 'chén']]);
  });

  it("strips parts' per-vessel 1 beside a dish count", () => {
    const d = held(
      '2 tô phở',
      dish(
        { vesselToken: 'tô', dishCount: count(2, 'tô') },
        ['bánh phở', 1, 'tô'],
        ['thịt bò', 1, 'tô']
      )
    );
    expect(counts(d).every(([c]) => c === null)).toBe(true);
  });

  it("keeps one part's own 1 beside a counted dish in the same unit", () => {
    // "2 slices of toast with 1 slice of cheese"
    const d = held(
      '2 slices of toast with 1 slice of cheese',
      dish({ dishCount: count(2, 'slice') }, ['toast'], ['cheese', 1, 'slice'])
    );
    expect(counts(d)).toEqual([
      [null, null],
      [1, 'slice'],
    ]);
  });

  it('keeps plural measures as each part’s own amount', () => {
    const d = held(
      'smoothie: 2 glasses of milk and 2 glasses of yogurt',
      dish({}, ['milk', 2, 'glasses'], ['yogurt', 2, 'glasses'])
    );
    expect(d.dishCount).toBeUndefined();
    expect(d.ingredients[0].count).toBe(2);
  });

  it("mirrors a one-food dish's own count to the dish, for a rescue", () => {
    const d = held(
      '1/2 chén bò kho',
      dish({ name: 'bò kho', vesselToken: 'chén' }, ['bò kho', 0.5, 'chén'])
    );
    expect(d.dishCount).toEqual(count(0.5, 'chén'));
    expect(counts(d)).toEqual([[0.5, 'chén']]);
    // A measure stays the food's.
    const milk = held('1 cup of milk', dish({}, ['milk', 1, 'cup']));
    expect(milk.dishCount).toBeUndefined();
  });

  it('matches an English plural to its singular', () => {
    const d = held(
      '2 bowls of ramen',
      dish(
        { vesselToken: 'bowl' },
        ['noodles', 2, 'bowls'],
        ['broth', 2, 'bowl']
      )
    );
    expect(d.dishCount).toEqual(count(2, 'bowls'));
    expect(counts(d).every(([c]) => c === null)).toBe(true);
  });

  it("leaves the parts' counts alone when a lifted count is not in the text", () => {
    const d = held(
      'burgers',
      dish({}, ['bun', 2, 'burger'], ['patty', 2, 'burger'])
    );
    expect(d.dishCount).toBeUndefined();
    expect(counts(d)).toEqual([
      [2, 'burger'],
      [2, 'burger'],
    ]);
  });

  it('drops a dish count the text does not hold', () => {
    const d = held(
      'a burger and fries',
      dish({ dishCount: count(3, 'burger') }, ['bun'], ['patty'])
    );
    expect(d.dishCount).toBeNull();
  });

  it('reads counts written as words, fractions and halves', () => {
    for (const [text, n] of [
      ['hai tô phở', 2],
      ['nửa dĩa cơm chiên', 0.5],
      ['half a plate of fried rice', 0.5],
      ['½ bowl of chili', 0.5],
      ['1/2 chén bò kho', 0.5],
      ['1 tô rưỡi bún bò', 1.5],
      ['a dozen dumplings', 12],
      ['a burger', 1],
      ['tô rưỡi phở', 1.5],
      ['1 to ruoi bun bo', 1.5],
      ['1 1/2 bowls of ramen', 1.5],
      ['2 ½ slices of pizza', 2.5],
      ['a quarter plate of fried rice', 0.25],
      ['three quarters of a bowl of pho', 0.75],
      ['two thirds of a pizza', 2 / 3],
    ] as const) {
      const d = held(text, dish({ dishCount: count(n, 'x') }, ['a'], ['b']));
      expect(d.dishCount?.count, text).toBe(n);
    }
  });

  it('puts a typed zero on every part, where the zero check asks about it', () => {
    const d = held(
      'zero burgers',
      dish({ dishCount: count(0, 'burger') }, ['bun'], ['patty'])
    );
    expect(d.dishCount).toBeNull();
    expect(counts(d)).toEqual([
      [0, 'burger'],
      [0, 'burger'],
    ]);
  });
});
