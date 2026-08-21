import { describe, expect, it } from 'vitest';
import { stripMicronutrients } from '@/lib/domain/nutrition/premium-scope';
import type {
  DaySeriesMetricKey,
  NutrientCardData,
  NutrientDaySeries,
  NutrientSummaryItem,
  NutritionNutrientKey,
  NutritionOverview,
} from '@/lib/domain/nutrition/types';

function card(nutrient: NutritionNutrientKey): NutrientCardData {
  return {
    nutrient,
    labelKey: `nutrition.nutrients.${nutrient}`,
    group: 'mineral',
    averagePerDay: 500,
    target: 1000,
    targetSource: 'vietnam_rda',
    targetSourceLabelKey: 'nutrition.sources.vietnamRda',
    unit: 'mg',
    percentOfTarget: 50,
    confidence: 0.9,
    displayState: 'normal',
    nutrientType: 'floor',
  };
}

function summaryItem(nutrient: NutritionNutrientKey): NutrientSummaryItem {
  return {
    nutrient,
    labelKey: `nutrition.nutrients.${nutrient}`,
    average: 500,
    unit: 'mg',
    percentOfTarget: 50,
    confidence: 0.9,
    status: 'below_target',
    nutrientType: 'floor',
  };
}

function series(metric: DaySeriesMetricKey): NutrientDaySeries {
  return {
    metric,
    labelKey: `nutrition.series.${metric}`,
    unit: 'g',
    target: 100,
    buckets: [
      {
        startDate: '2026-05-01',
        endDate: '2026-05-01',
        value: 50,
        ratioOfTarget: 0.5,
        excluded: false,
      },
    ],
    min: 50,
    max: 50,
  };
}

const macroConsistency = {
  averageConsistencyPct: 75,
  weakestMacro: 'protein' as const,
};

function overview(): NutritionOverview {
  return {
    requestedRange: 'auto',
    resolvedRange: '7d',
    bucketTimezone: 'local',
    loggedDays: 3,
    completeDays: 3,
    partialDays: 0,
    loggedDaysLast30: 14,
    trendStatus: 'ready',
    period: { startDate: '2026-04-20', endDate: '2026-04-26' },
    summary: {
      mostConsistent: [summaryItem('calciumMg')],
      needsAttention: [summaryItem('ironMg')],
      limitedDataCount: 4,
      macroConsistency,
    },
    calorieAverages: {
      all: { averagePerDay: 2000, days: 3 },
      complete: { averagePerDay: 2000, days: 3 },
    },
    previousCalorieAverages: {
      all: { averagePerDay: 1800, days: 3 },
      complete: { averagePerDay: 1800, days: 2 },
    },
    macros: [
      {
        key: 'protein',
        labelKey: 'nutrition.macros.protein',
        averagePerDay: 100,
        target: 100,
        unit: 'g',
        consistencyPct: 67,
        nutrientType: 'floor',
      },
    ],
    daySeries: {
      unit: 'day',
      series: [
        series('calories'),
        series('protein'),
        series('carbohydrate'),
        series('fat'),
        series('calciumMg'),
        series('vitaminCMg'),
      ],
    },
    micronutrients: [card('calciumMg')],
    spotlight: [card('ironMg')],
    steady: [card('zincMg')],
    moreNutrients: [card('copperMcg')],
    educationCards: [
      {
        id: 'vitamin_d',
        titleKey: 'nutrition.education.vitaminD.title',
        bodyKey: 'nutrition.education.vitaminD.body',
      },
    ],
    micronutrientsLocked: false,
  };
}

describe('stripMicronutrients', () => {
  it('empties every micronutrient array and sets the lock flag', () => {
    const stripped = stripMicronutrients(overview());

    expect(stripped.micronutrients).toEqual([]);
    expect(stripped.spotlight).toEqual([]);
    expect(stripped.steady).toEqual([]);
    expect(stripped.moreNutrients).toEqual([]);
    expect(stripped.educationCards).toEqual([]);
    expect(stripped.micronutrientsLocked).toBe(true);
  });

  it('empties the summary lists and its limited-data count, keeping macro consistency', () => {
    const stripped = stripMicronutrients(overview());

    expect(stripped.summary.mostConsistent).toEqual([]);
    expect(stripped.summary.needsAttention).toEqual([]);
    expect(stripped.summary.limitedDataCount).toBe(0);
    expect(stripped.summary.macroConsistency).toEqual(macroConsistency);
  });

  it('keeps exactly the macro series on the time axis', () => {
    const stripped = stripMicronutrients(overview());

    expect(stripped.daySeries.unit).toBe('day');
    expect(stripped.daySeries.series.map((entry) => entry.metric)).toEqual([
      'calories',
      'protein',
      'carbohydrate',
      'fat',
    ]);
  });

  it('leaves calories, macros, and the window metadata untouched', () => {
    const input = overview();
    const stripped = stripMicronutrients(input);

    expect(stripped.macros).toEqual(input.macros);
    expect(stripped.calorieAverages).toEqual(input.calorieAverages);
    expect(stripped.previousCalorieAverages).toEqual(
      input.previousCalorieAverages
    );
    expect(stripped.loggedDays).toBe(3);
    expect(stripped.resolvedRange).toBe('7d');
    expect(stripped.trendStatus).toBe('ready');
  });

  it('does not mutate the overview it was given', () => {
    const input = overview();
    stripMicronutrients(input);

    expect(input).toEqual(overview());
  });
});
