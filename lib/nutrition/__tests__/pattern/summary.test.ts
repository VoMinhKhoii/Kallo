import { describe, expect, it } from 'vitest';
import {
  bucketNutrients,
  getMacroConsistency,
  getMacroConsistencySummary,
  getTrendStatus,
  resolveInitialRange,
} from '@/lib/nutrition/pattern/summary';
import type { NutrientSummaryItem } from '@/lib/nutrition/types';

function createSummaryItem(
  overrides: Partial<NutrientSummaryItem>
): NutrientSummaryItem {
  return {
    nutrient: 'calciumMg',
    labelKey: 'nutrition.nutrients.calcium',
    average: 500,
    unit: 'mg',
    percentOfTarget: 50,
    confidence: 80,
    status: 'adequate',
    applicability: 'scored',
    nutrientType: 'floor',
    ...overrides,
  };
}

describe('nutrition summary helpers', () => {
  it('treats low-confidence below-target nutrients as limited data', () => {
    const buckets = bucketNutrients([
      createSummaryItem({ confidence: 39.9, status: 'below_target' }),
    ]);

    expect(buckets.needsAttention).toEqual([]);
    expect(buckets.mostConsistent).toEqual([]);
    expect(buckets.limitedDataCount).toBe(1);
  });

  it('treats confidence of exactly 40 as eligible for needs attention', () => {
    const belowTarget = createSummaryItem({
      confidence: 40,
      status: 'below_target',
    });

    const buckets = bucketNutrients([belowTarget]);

    expect(buckets.needsAttention).toEqual([belowTarget]);
    expect(buckets.limitedDataCount).toBe(0);
  });

  it('puts high-confidence above-target nutrients into most consistent', () => {
    const aboveTarget = createSummaryItem({
      confidence: 80,
      status: 'above_target',
    });

    const buckets = bucketNutrients([aboveTarget]);

    expect(buckets.mostConsistent).toEqual([aboveTarget]);
    expect(buckets.needsAttention).toEqual([]);
    expect(buckets.limitedDataCount).toBe(0);
  });

  it('excludes ceiling nutrients above target from most consistent', () => {
    // Sodium at 200% of cap is "exceeded ceiling" — must NOT be celebrated as
    // consistent. Range nutrients above target are likewise excluded.
    const sodium = createSummaryItem({
      nutrient: 'sodiumMg',
      confidence: 80,
      status: 'above_target',
      percentOfTarget: 200,
      nutrientType: 'ceiling',
    });
    const rangeOver = createSummaryItem({
      confidence: 80,
      status: 'above_target',
      percentOfTarget: 130,
      nutrientType: 'range',
    });

    const buckets = bucketNutrients([sodium, rangeOver]);

    expect(buckets.mostConsistent).toEqual([]);
    expect(buckets.needsAttention).toEqual([]);
    expect(buckets.limitedDataCount).toBe(0);
  });

  it('excludes educational and unsupported nutrients from all summary buckets', () => {
    const buckets = bucketNutrients([
      createSummaryItem({
        applicability: 'educational',
        confidence: 10,
        status: 'below_target',
      }),
      createSummaryItem({
        nutrient: 'vitaminDMcg',
        applicability: 'unsupported',
        confidence: 10,
        status: 'limited_data',
      }),
    ]);

    expect(buckets).toEqual({
      mostConsistent: [],
      needsAttention: [],
      limitedDataCount: 0,
    });
  });

  it('calorie consistency is goal-aware: maintaining requires exact equality after rounding', () => {
    // 2000.4 and 1999.6 both round to 2000; 1800 and 2200 don't.
    expect(
      getMacroConsistency({
        macro: 'calories',
        target: 2000,
        values: [2000.4, 1999.6, 1800, 2200],
        goal: 'maintaining',
      })
    ).toBe(50);

    // No goal supplied → default to maintaining (spec §8.3 fallback).
    expect(
      getMacroConsistency({
        macro: 'calories',
        target: 2000,
        values: [2000, 1999, 2001],
      })
    ).toBe(33);
  });

  it('calorie consistency is goal-aware: cutting counts days at or under target', () => {
    expect(
      getMacroConsistency({
        macro: 'calories',
        target: 2000,
        values: [1500, 1999, 2000, 2001, 2500],
        goal: 'cutting',
      })
    ).toBe(60);
  });

  it('calorie consistency is goal-aware: bulking counts days at or over target', () => {
    expect(
      getMacroConsistency({
        macro: 'calories',
        target: 2000,
        values: [1500, 1999, 2000, 2001, 2500],
        goal: 'bulking',
      })
    ).toBe(60);
  });

  it('uses macro-specific thresholds for non-calorie consistency', () => {
    expect(
      getMacroConsistency({
        macro: 'protein',
        target: 100,
        values: [90, 89],
      })
    ).toBe(50);

    expect(
      getMacroConsistency({
        macro: 'carbohydrate',
        target: 200,
        values: [170, 230, 169],
      })
    ).toBe(67);
  });

  it('summarizes macro consistency averages and weakest macro', () => {
    expect(
      getMacroConsistencySummary({
        calories: 100,
        protein: 80,
        carbohydrate: 60,
        fat: 40,
      })
    ).toEqual({
      averageConsistencyPct: 70,
      weakestMacro: 'fat',
    });
  });

  it('resolves the initial range from recent logged days', () => {
    expect(resolveInitialRange(13)).toBe('7d');
    expect(resolveInitialRange(14)).toBe('30d');
  });

  it('applies logged-day thresholds for each trend range', () => {
    expect(getTrendStatus('7d', 2)).toBe('too_few_logged_days');
    expect(getTrendStatus('7d', 3)).toBe('ready');
    expect(getTrendStatus('30d', 9)).toBe('too_few_logged_days');
    expect(getTrendStatus('30d', 10)).toBe('ready');
    expect(getTrendStatus('90d', 29)).toBe('too_few_logged_days');
    expect(getTrendStatus('90d', 30)).toBe('ready');
  });
});
