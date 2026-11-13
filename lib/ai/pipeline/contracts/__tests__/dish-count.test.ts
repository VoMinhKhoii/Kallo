import { describe, expect, it } from 'vitest';
import type { DecomposedDishV2 } from '@/lib/ai/pipeline/contracts/schemas/decomposition-v2';
import { isDishCount } from '../dish-count';

const dish = (
  ...parts: Array<[name: string, count?: number, unitToken?: string]>
): DecomposedDishV2 => ({
  name: 'dish',
  cookingMethod: 'fried',
  ingredients: parts.map(([rawName, count, unitToken]) => ({
    rawName,
    canonicalName: rawName,
    ...(count != null ? { count } : {}),
    ...(unitToken ? { unitToken } : {}),
  })),
});

describe('isDishCount', () => {
  it('reads a count every part shares, in the same unit, as the dish count', () => {
    const d = dish(
      ['bun', 2, 'burger'],
      ['patty', 2, 'burger'],
      ['oil', 2, 'burger']
    );
    expect(d.ingredients.map((p) => isDishCount(d, p))).toEqual([
      true,
      true,
      true,
    ]);
  });

  it("keeps a part's own count when no other part shares it", () => {
    const d = dish(['tortilla', 1, 'tortilla'], ['rice'], ['beans']);
    expect(isDishCount(d, d.ingredients[0])).toBe(false);
  });

  it('keeps shared spoon and gram measures as each part’s own amount', () => {
    const d = dish(
      ['dầu ăn', 1, 'muỗng'],
      ['nước mắm', 1, 'muỗng'],
      ['trứng', 2, 'quả']
    );
    expect(isDishCount(d, d.ingredients[0])).toBe(false);
    expect(isDishCount(d, d.ingredients[1])).toBe(false);
  });

  it("reads the oil beside one counted food as copying that food's count", () => {
    // "2 omelettes": the egg's count is typed, the oil only copies it.
    const d = dish(['egg', 2, 'omelette'], ['oil', 2, 'omelette']);
    expect(isDishCount(d, d.ingredients[0])).toBe(false);
    expect(isDishCount(d, d.ingredients[1])).toBe(true);
  });

  it('never calls a part without a count a dish count', () => {
    const d = dish(['egg', 2, 'omelette'], ['oil']);
    expect(isDishCount(d, d.ingredients[1])).toBe(false);
  });

  it('keeps equal counts typed for some foods of a dish as typed', () => {
    // "salad 400g gồm 2 quả trứng, 2 quả cà chua và rau"
    const d = dish(['trứng', 2, 'quả'], ['cà chua', 2, 'quả'], ['rau xà lách']);
    expect(isDishCount(d, d.ingredients[0])).toBe(false);
    expect(isDishCount(d, d.ingredients[1])).toBe(false);
  });

  it('reads the oil as carrying the dish count whether or not it has one', () => {
    const d = dish(
      ['bột gạo', 2, 'bánh xèo'],
      ['tôm', 2, 'bánh xèo'],
      ['dầu ăn']
    );
    expect(isDishCount(d, d.ingredients[0])).toBe(true);
  });

  it('needs the same number as well as the same unit', () => {
    const d = dish(['quail egg', 2, 'quả'], ['chicken egg', 1, 'quả']);
    expect(isDishCount(d, d.ingredients[0])).toBe(false);
  });
});
