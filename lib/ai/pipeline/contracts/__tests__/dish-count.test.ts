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

  it('never calls a part without a count a dish count', () => {
    const d = dish(['egg', 2, 'omelette'], ['oil']);
    expect(isDishCount(d, d.ingredients[1])).toBe(false);
  });

  it('needs the same number as well as the same unit', () => {
    const d = dish(['quail egg', 2, 'quả'], ['chicken egg', 1, 'quả']);
    expect(isDishCount(d, d.ingredients[0])).toBe(false);
  });
});
