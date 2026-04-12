import { describe, expect, it } from 'vitest';
import {
  computeStreamingMealItem,
  extractCompletedMealItemNutrition,
  extractMealItemNames,
} from '../parsers';

describe('extractMealItemNames', () => {
  it('extracts meal item names from partial JSON', () => {
    const accumulated =
      '{"mealItems":[{"name":"Cơm trắng","ingredients":[{"name":"Gạo tẻ"';
    const seen = new Set<string>();
    const names = extractMealItemNames(accumulated, seen);

    expect(names).toEqual(['Cơm trắng']);
    expect(seen.has('Cơm trắng')).toBe(true);
  });

  it('does not re-extract already seen names', () => {
    const accumulated =
      '{"mealItems":[{"name":"Phở bò","ingredients":[{"name":"Bún phở"}]}]}';
    const seen = new Set<string>(['Phở bò']);
    const names = extractMealItemNames(accumulated, seen);

    expect(names).toEqual([]);
  });

  it('extracts multiple meal item names as they accumulate', () => {
    const seen = new Set<string>();

    // First chunk: only first item
    const chunk1 =
      '{"mealItems":[{"name":"Cơm trắng","ingredients":[{"name":"Gạo tẻ","estimatedGrams":200}]}';
    const names1 = extractMealItemNames(chunk1, seen);
    expect(names1).toEqual(['Cơm trắng']);

    // Second chunk: both items visible, but first is already seen
    const chunk2 = `${chunk1},{"name":"Canh chua","ingredients":[`;
    const names2 = extractMealItemNames(chunk2, seen);
    expect(names2).toEqual(['Canh chua']);
  });

  it('ignores ingredient names (no ,"ingredients": after them)', () => {
    const accumulated =
      '{"name":"Cơm trắng","ingredients":[{"name":"Gạo tẻ","estimatedGrams":200}]}';
    const seen = new Set<string>();
    const names = extractMealItemNames(accumulated, seen);

    // Only "Cơm trắng" has ,"ingredients": after it
    expect(names).toEqual(['Cơm trắng']);
    expect(seen.has('Gạo tẻ')).toBe(false);
  });

  it('handles Vietnamese diacritics', () => {
    const accumulated = '{"name":"Bún bò Huế","ingredients":[';
    const seen = new Set<string>();
    const names = extractMealItemNames(accumulated, seen);

    expect(names).toEqual(['Bún bò Huế']);
  });
});

describe('extractCompletedMealItemNutrition', () => {
  const fullJson = `{"mealItems":[
    {"mealItemName":"Cơm trắng","ingredients":[
      {"ingredientName":"Gạo tẻ","caloriesKcal":{"low":250,"mid":260,"high":270},"proteinG":{"low":4,"mid":5,"high":6},"carbohydrateG":{"low":55,"mid":57,"high":59},"fatG":{"low":0.5,"mid":1,"high":1.5}}
    ]},
    {"mealItemName":"Thịt kho","ingredients":[
      {"ingredientName":"Thịt heo","caloriesKcal":{"low":200,"mid":220,"high":240},"proteinG":{"low":18,"mid":20,"high":22},"carbohydrateG":{"low":0,"mid":1,"high":2},"fatG":{"low":14,"mid":16,"high":18}}
    ]}
  ]}`;

  it('extracts completed items when boundary detected', () => {
    // Simulate stream with second item started but not finished
    const partial = fullJson.split('"mealItemName":"Thịt kho"')[0];
    const accumulated = `${partial}"mealItemName":"Thịt kho","ingredients":[{"ingredientNa`;

    const { items, newCount } = extractCompletedMealItemNutrition(
      accumulated,
      0
    );

    expect(newCount).toBe(1);
    expect(items).toHaveLength(1);
    expect(items[0].mealItemName).toBe('Cơm trắng');
  });

  it('skips already extracted items', () => {
    const { items, newCount } = extractCompletedMealItemNutrition(fullJson, 1);

    // Already extracted 1 item, and 2nd is the last (no next boundary)
    expect(newCount).toBe(1);
    expect(items).toHaveLength(0);
  });

  it('returns empty when only one item visible (no boundary)', () => {
    const singleItem = '{"mealItems":[{"mealItemName":"Phở bò","ingredients":[';
    const { items, newCount } = extractCompletedMealItemNutrition(
      singleItem,
      0
    );

    expect(items).toHaveLength(0);
    expect(newCount).toBe(0);
  });
});

describe('computeStreamingMealItem', () => {
  it('sums ingredient macros with goal adjustment', () => {
    const nutrition = {
      mealItemName: 'Cơm trắng',
      ingredients: [
        {
          ingredientName: 'Gạo tẻ',
          caloriesKcal: { low: 250, mid: 260, high: 270 },
          proteinG: { low: 4, mid: 5, high: 6 },
          carbohydrateG: { low: 55, mid: 57, high: 59 },
          fatG: { low: 0.5, mid: 1, high: 1.5 },
        },
      ],
    };

    const result = computeStreamingMealItem(nutrition, 200, 0, 'cutting', 0.5);

    expect(result.id).toBe('item-1');
    expect(result.name).toBe('Cơm trắng');
    expect(result.quantity).toBe(200);
    expect(result.unit).toBe('g');
    // Cutting: calories use high bound → 260 + 0.5*(270-260) = 265
    expect(result.macros.calories).toBe(265);
    // Cutting: protein uses low bound → 5 + 0.5*(4-5) = 4.5 → rounds to 5
    expect(result.macros.protein).toBe(5);
  });

  it('returns zero macros for maintaining (aggression=0)', () => {
    const nutrition = {
      mealItemName: 'Test',
      ingredients: [
        {
          ingredientName: 'Ing1',
          caloriesKcal: { low: 100, mid: 200, high: 300 },
          proteinG: { low: 5, mid: 10, high: 15 },
          carbohydrateG: { low: 20, mid: 30, high: 40 },
          fatG: { low: 3, mid: 6, high: 9 },
        },
      ],
    };

    const result = computeStreamingMealItem(
      nutrition,
      100,
      0,
      'maintaining',
      0
    );

    // With aggression=0, should use mid values
    expect(result.macros.calories).toBe(200);
    expect(result.macros.protein).toBe(10);
    expect(result.macros.carbs).toBe(30);
    expect(result.macros.fat).toBe(6);
  });

  it('sums across multiple ingredients', () => {
    const nutrition = {
      mealItemName: 'Phở bò',
      ingredients: [
        {
          ingredientName: 'Bún phở',
          caloriesKcal: { low: 200, mid: 200, high: 200 },
          proteinG: { low: 4, mid: 4, high: 4 },
          carbohydrateG: { low: 45, mid: 45, high: 45 },
          fatG: { low: 0.5, mid: 0.5, high: 0.5 },
        },
        {
          ingredientName: 'Thịt bò',
          caloriesKcal: { low: 150, mid: 150, high: 150 },
          proteinG: { low: 20, mid: 20, high: 20 },
          carbohydrateG: { low: 0, mid: 0, high: 0 },
          fatG: { low: 8, mid: 8, high: 8 },
        },
      ],
    };

    const result = computeStreamingMealItem(
      nutrition,
      400,
      1,
      'maintaining',
      0
    );

    expect(result.macros.calories).toBe(350);
    expect(result.macros.protein).toBe(24);
    expect(result.macros.carbs).toBe(45);
    expect(result.macros.fat).toBe(9);
  });
});
