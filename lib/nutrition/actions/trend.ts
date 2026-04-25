'use server';

import { requireAuthAndProfile } from '@/lib/auth';
import {
  getCaloriesWithNutrientData,
  getNutrientConfidence,
} from '../confidence';
import { getNutritionPeriod } from '../date-range';
import { HIDDEN_NUTRIENTS } from '../nutrients';
import { nutrientTrendInputSchema } from '../schemas';
import type { NutrientTrend } from '../types';
import { fetchTrendRows } from './trend-query';

const HIDDEN_NUTRIENT_SET = new Set<string>(HIDDEN_NUTRIENTS);

interface UtcBounds {
  startAt: Date;
  endAt: Date;
}

function localDateMidnightUtc(
  date: string,
  timezoneOffset: number | null
): number {
  const midnightUtc = Date.parse(`${date}T00:00:00.000Z`);
  return timezoneOffset === null
    ? midnightUtc
    : midnightUtc + timezoneOffset * 60_000;
}

function getInclusiveUtcBounds(
  period: { startDate: string; endDate: string },
  timezoneOffset: number | null
): UtcBounds {
  const startAt = new Date(
    localDateMidnightUtc(period.startDate, timezoneOffset)
  );
  const exclusiveEnd =
    localDateMidnightUtc(period.endDate, timezoneOffset) + 24 * 60 * 60 * 1000;

  return {
    startAt,
    endAt: new Date(exclusiveEnd - 1),
  };
}

export async function getNutrientTrend(input: unknown): Promise<NutrientTrend> {
  const parsed = nutrientTrendInputSchema.parse(input);

  if (HIDDEN_NUTRIENT_SET.has(parsed.nutrient)) {
    throw new Error('Hidden nutrients cannot be trended.');
  }

  const { user } = await requireAuthAndProfile();
  const period = getNutritionPeriod({
    range: parsed.range,
    timezoneOffset: parsed.timezoneOffset,
  });
  const bounds = getInclusiveUtcBounds(period, parsed.timezoneOffset);
  const rows = await fetchTrendRows({
    userId: user.id,
    nutrient: parsed.nutrient,
    startDate: period.startDate,
    endDate: period.endDate,
    startAt: bounds.startAt,
    endAt: bounds.endAt,
    timezoneOffset: parsed.timezoneOffset,
  });
  const dayBuckets = new Map<
    string,
    {
      calories: number;
      caloriesWithData: number;
      value: number;
      hasData: boolean;
    }
  >();

  for (const row of rows) {
    const bucket = dayBuckets.get(row.localDate) ?? {
      calories: 0,
      caloriesWithData: 0,
      value: 0,
      hasData: false,
    };

    bucket.calories += Math.max(0, row.calories);
    if (row.value !== null) {
      bucket.caloriesWithData += Math.max(0, row.calories);
      bucket.value += row.value;
      bucket.hasData = true;
    }
    dayBuckets.set(row.localDate, bucket);
  }

  const totalCalories = rows.reduce(
    (sum, row) => sum + Math.max(0, row.calories),
    0
  );
  const overallConfidence = getNutrientConfidence({
    totalCalories,
    caloriesWithNutrientData: getCaloriesWithNutrientData(
      rows.map((row) => ({ calories: row.calories, nutrientValue: row.value }))
    ),
  });

  return {
    nutrient: parsed.nutrient,
    range: parsed.range,
    bucketTimezone: period.bucketTimezone,
    displayMode:
      overallConfidence >= 40
        ? 'line'
        : overallConfidence >= 20
          ? 'points'
          : 'insufficient_data',
    points: [...dayBuckets.entries()]
      .sort(([dateA], [dateB]) => dateA.localeCompare(dateB))
      .map(([date, bucket]) => ({
        date,
        value: bucket.hasData ? bucket.value : null,
        confidence: getNutrientConfidence({
          totalCalories: bucket.calories,
          caloriesWithNutrientData: bucket.caloriesWithData,
        }),
      })),
  };
}
