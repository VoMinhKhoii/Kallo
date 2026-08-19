import { describe, expect, it } from 'vitest';
import type { MatchedIngredient } from '@/lib/ai/types/matching';

describe('MatchedIngredient.dbState', () => {
  it("is one of 'raw' | 'cooked' | 'unknown'", () => {
    const sample: MatchedIngredient = {
      ingredientName: 'cá lóc',
      foodCompositionId: 'fc-1',
      matchedName: 'Cá quả',
      similarity: 0.9,
      confidence: 'high',
      nutritionPer100g: {} as MatchedIngredient['nutritionPer100g'],
      dbState: 'raw',
    };
    expect(['raw', 'cooked', 'unknown']).toContain(sample.dbState);
  });
});
