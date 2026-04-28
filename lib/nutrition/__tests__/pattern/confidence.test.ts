import { describe, expect, it } from 'vitest';

import {
  getCaloriesWithNutrientData,
  getConfidenceDisplayState,
  getConfidenceMetadata,
  getNutrientConfidence,
} from '@/lib/nutrition/pattern/confidence';

describe('nutrition confidence helpers', () => {
  it('calculates nutrient confidence to one decimal place', () => {
    expect(
      getNutrientConfidence({
        totalCalories: 800,
        caloriesWithNutrientData: 500,
      })
    ).toBe(62.5);
  });

  it('returns confidence metadata with missing calories', () => {
    expect(
      getConfidenceMetadata({
        totalCalories: 800,
        caloriesWithNutrientData: 500,
      })
    ).toEqual({
      confidence: 62.5,
      caloriesMissingNutrientData: 300,
    });
  });

  it('counts zero nutrient values as present', () => {
    expect(
      getCaloriesWithNutrientData([
        { calories: 300, nutrientValue: 1.2 },
        { calories: 500, nutrientValue: 0 },
      ])
    ).toBe(800);
  });

  it('excludes null nutrient values from the numerator', () => {
    expect(
      getCaloriesWithNutrientData([
        { calories: 300, nutrientValue: 1.2 },
        { calories: 500, nutrientValue: null },
      ])
    ).toBe(300);
  });

  it('returns zero confidence for empty periods', () => {
    expect(
      getNutrientConfidence({
        totalCalories: 0,
        caloriesWithNutrientData: 500,
      })
    ).toBe(0);
  });

  it('maps display state thresholds exactly', () => {
    expect(getConfidenceDisplayState(70)).toBe('normal');
    expect(getConfidenceDisplayState(69.9)).toBe('limited_data');
    expect(getConfidenceDisplayState(40)).toBe('limited_data');
    expect(getConfidenceDisplayState(39.9)).toBe('warning_points');
    expect(getConfidenceDisplayState(20)).toBe('warning_points');
    expect(getConfidenceDisplayState(19.9)).toBe('insufficient_data');
  });
});
