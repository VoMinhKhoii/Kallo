import { describe, expect, it } from 'vitest';
import { checkDecompositionLanguage } from '@/lib/ai/language/guard';
import type { MealDecomposition } from '@/lib/ai/types';

function decomposition(names: string[]): MealDecomposition {
  return {
    isFood: true,
    mealSlot: null,
    mealItems: names.map((name) => ({
      name,
      cookingMethod: 'raw',
      ingredients: [
        {
          rawName: name,
          canonicalName: name,
          grams: 100,
        },
      ],
    })),
  };
}

describe('checkDecompositionLanguage', () => {
  it('passes clear English output for English requests', () => {
    expect(
      checkDecompositionLanguage(decomposition(['grilled chicken', 'rice']), {
        inputLanguage: 'en',
        outputLanguage: 'en',
      })
    ).toEqual({
      ok: true,
      reason: 'matches_output_language',
      severity: 'info',
    });
  });

  it('passes clear Vietnamese output for Vietnamese requests', () => {
    expect(
      checkDecompositionLanguage(decomposition(['cơm gà', 'rau luộc']), {
        inputLanguage: 'vi',
        outputLanguage: 'vi',
      })
    ).toEqual({
      ok: true,
      reason: 'matches_output_language',
      severity: 'info',
    });
  });

  it('fails clear Vietnamese output for English requests', () => {
    expect(
      checkDecompositionLanguage(decomposition(['ức gà nướng', 'cơm trắng']), {
        inputLanguage: 'en',
        outputLanguage: 'en',
      })
    ).toEqual({
      ok: false,
      reason: 'expected_english_found_vietnamese',
      severity: 'error',
    });
  });

  it('fails clear English output for Vietnamese requests', () => {
    expect(
      checkDecompositionLanguage(
        decomposition(['chicken rice', 'boiled veg']),
        {
          inputLanguage: 'vi',
          outputLanguage: 'vi',
        }
      )
    ).toEqual({
      ok: false,
      reason: 'expected_vietnamese_found_english',
      severity: 'error',
    });
  });

  it('passes mixed input as uncertain instead of blocking', () => {
    expect(
      checkDecompositionLanguage(decomposition(['pho bo with beef']), {
        inputLanguage: 'mixed',
        outputLanguage: 'en',
      })
    ).toEqual({
      ok: true,
      reason: 'uncertain_input_language',
      severity: 'info',
    });
  });

  it('preserves brand-heavy English names', () => {
    expect(
      checkDecompositionLanguage(decomposition(['KFC zinger burger']), {
        inputLanguage: 'en',
        outputLanguage: 'en',
      })
    ).toEqual({
      ok: true,
      reason: 'matches_output_language',
      severity: 'info',
    });
  });
});
