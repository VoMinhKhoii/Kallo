'use server';

import { and, asc, desc, eq, gte, lt, sql } from 'drizzle-orm';
import { z } from 'zod';
import { dayKeyToUtcDate, toUtcDayKey } from '@/lib/core/date/day-key';
import { getUtcDayRangeForLocalDate } from '@/lib/core/date/local-day';
import { MS_PER_DAY } from '@/lib/core/date/ms';
import type {
  HeatmapData,
  HeatmapRange,
  VerdictData,
} from '@/lib/core/types/dashboard';
import { timezoneOffsetSchema } from '@/lib/core/validation/primitives';
import {
  buildCalorieAdherenceHeatmapData,
  getLocalDateKey,
} from '@/lib/domain/dashboard/adherence';
import { requireAuthAndProfile } from '@/lib/infra/auth/session';
import { db } from '@/lib/infra/db';
import { bodyWeightLog, meals } from '@/lib/infra/db/schema';
import { loadWeightSummaryAction } from './weight';

const loadCalorieAdherenceHeatmapSchema = z.object({
  range: z.enum(['30d', '90d', 'year']),
  timezoneOffset: timezoneOffsetSchema,
});

const loadVerdictSchema = z.object({
  timezoneOffset: timezoneOffsetSchema,
});

const RANGE_DAYS = {
  '30d': 30,
  '90d': 90,
} as const;

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * MS_PER_DAY);
}

function getUtcBoundaryForLocalDate(
  dateKey: string,
  timezoneOffset: number
): Date {
  return getUtcDayRangeForLocalDate(dateKey, timezoneOffset).dayStart;
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export async function loadCalorieAdherenceHeatmap(input: {
  range: HeatmapRange;
  timezoneOffset: number;
}): Promise<HeatmapData> {
  const parsed = loadCalorieAdherenceHeatmapSchema.parse(input);
  const { user, profile } = await requireAuthAndProfile();

  const now = new Date();
  const endKey = getLocalDateKey(now, parsed.timezoneOffset);
  const endDate = dayKeyToUtcDate(endKey);
  const startDate =
    parsed.range === 'year'
      ? new Date(Date.UTC(Number(endKey.slice(0, 4)), 0, 1))
      : addDays(endDate, -(RANGE_DAYS[parsed.range] - 1));
  const rangeEndDate =
    parsed.range === 'year'
      ? new Date(Date.UTC(Number(endKey.slice(0, 4)) + 1, 0, 1))
      : addDays(endDate, 1);
  const startKey = toUtcDayKey(startDate);
  const nextEndKey = toUtcDayKey(rangeEndDate);

  const utcStart = getUtcBoundaryForLocalDate(startKey, parsed.timezoneOffset);
  const utcEnd = getUtcBoundaryForLocalDate(nextEndKey, parsed.timezoneOffset);
  const offsetMins = -parsed.timezoneOffset;
  const localDateExpr = sql<string>`DATE(${meals.loggedAt} + (${sql.raw(String(offsetMins))}::integer * INTERVAL '1 minute'))`;
  const caloriesExpr = sql<number>`COALESCE(SUM(${meals.caloriesKcal}), 0)`;
  const hasCheatExpr = sql<boolean>`BOOL_OR(${meals.entryMode} = 'cheat')`;

  const dailyCalories = await db
    .select({
      date: localDateExpr.as('date'),
      calories: caloriesExpr.as('calories'),
      hasCheatMeal: hasCheatExpr.as('has_cheat_meal'),
    })
    .from(meals)
    .where(
      and(
        eq(meals.userId, user.id),
        gte(meals.loggedAt, utcStart),
        lt(meals.loggedAt, utcEnd)
      )
    )
    .groupBy(localDateExpr)
    .orderBy(asc(localDateExpr));

  return buildCalorieAdherenceHeatmapData({
    range: parsed.range,
    dailyCalories: dailyCalories.map((day) => ({
      date: day.date,
      calories: Number(day.calories),
      hasCheatMeal: Boolean(day.hasCheatMeal),
    })),
    calorieTarget: profile.calorieTarget,
    timezoneOffset: parsed.timezoneOffset,
    now,
  });
}

export async function loadVerdictAction(input: {
  timezoneOffset: number;
}): Promise<VerdictData> {
  const parsed = loadVerdictSchema.parse(input);
  const { user, profile } = await requireAuthAndProfile();
  const timezoneOffset = parsed.timezoneOffset;

  const weightSummary = await loadWeightSummaryAction({
    range: '30d',
    timezoneOffset,
  });

  const now = new Date();
  const endKey = getLocalDateKey(now, timezoneOffset);
  const endDate = dayKeyToUtcDate(endKey);
  const startDate = addDays(endDate, -6);
  const startKey = toUtcDayKey(startDate);
  const nextEndKey = toUtcDayKey(addDays(endDate, 1));
  const utcStart = getUtcBoundaryForLocalDate(startKey, timezoneOffset);
  const utcEnd = getUtcBoundaryForLocalDate(nextEndKey, timezoneOffset);

  const weightRows = await db
    .select({
      loggedDate: bodyWeightLog.loggedDate,
      weightKg: bodyWeightLog.weightKg,
    })
    .from(bodyWeightLog)
    .where(eq(bodyWeightLog.userId, user.id))
    .orderBy(desc(bodyWeightLog.loggedDate), desc(bodyWeightLog.createdAt))
    .limit(14);

  const orderedWeights = [...weightRows].reverse();
  const firstWeightRow = orderedWeights[0];
  const lastWeightRow = orderedWeights[orderedWeights.length - 1];
  const currentWeight = weightSummary.currentWeight;
  const firstWeight = Number(firstWeightRow?.weightKg ?? currentWeight);
  const lastWeight = Number(lastWeightRow?.weightKg ?? currentWeight);
  const totalDelta =
    orderedWeights.length > 0 ? currentWeight - firstWeight : 0;
  const elapsedDays =
    firstWeightRow && lastWeightRow
      ? (dayKeyToUtcDate(lastWeightRow.loggedDate).getTime() -
          dayKeyToUtcDate(firstWeightRow.loggedDate).getTime()) /
        MS_PER_DAY
      : 0;
  const weeklyRate =
    orderedWeights.length > 1 && elapsedDays > 0
      ? (lastWeight - firstWeight) / (elapsedDays / 7)
      : 0;
  const actual30DayDelta = weeklyRate * 4.3;
  const targetDelta =
    weightSummary.expectedEndWeight - weightSummary.periodStartWeight;
  const rollingAvgStart = average(
    orderedWeights
      .slice(0, Math.min(7, orderedWeights.length))
      .map((row) => Number(row.weightKg))
  );
  const rollingAvgEnd = average(
    orderedWeights
      .slice(-Math.min(7, orderedWeights.length))
      .map((row) => Number(row.weightKg))
  );

  const proteinDays: [
    boolean,
    boolean,
    boolean,
    boolean,
    boolean,
    boolean,
    boolean,
  ] = [false, false, false, false, false, false, false];
  const offsetMins = -timezoneOffset;
  const localDateExpr = sql<string>`DATE(${meals.loggedAt} + (${sql.raw(String(offsetMins))}::integer * INTERVAL '1 minute'))`;
  const weekdayExpr = sql<number>`EXTRACT(ISODOW FROM ${localDateExpr})`;
  const proteinExpr = sql<number>`COALESCE(SUM(${meals.proteinG}), 0)`;

  const dailyProtein = await db
    .select({
      date: localDateExpr.as('date'),
      weekday: weekdayExpr.as('weekday'),
      protein: proteinExpr.as('protein'),
    })
    .from(meals)
    .where(
      and(
        eq(meals.userId, user.id),
        gte(meals.loggedAt, utcStart),
        lt(meals.loggedAt, utcEnd)
      )
    )
    .groupBy(localDateExpr, weekdayExpr)
    .orderBy(asc(localDateExpr));

  const proteinTarget = profile.proteinTargetG ?? 100; // Default to 100g if not set
  dailyProtein.forEach((day) => {
    const adjustedIndex = Number(day.weekday) - 1;
    if (adjustedIndex < 0 || adjustedIndex > 6) return;
    if (Number(day.protein) >= proteinTarget) {
      proteinDays[adjustedIndex] = true;
    }
  });

  const tooEarlyThreshold = 0.1;
  let status: VerdictData['status'];
  if (
    orderedWeights.length < 2 ||
    Math.abs(actual30DayDelta) < tooEarlyThreshold
  ) {
    status = 'too_early';
  } else if (Math.abs(actual30DayDelta - targetDelta) < tooEarlyThreshold) {
    status = 'on_pace';
  } else if (
    (targetDelta < 0 && actual30DayDelta < targetDelta) ||
    (targetDelta > 0 && actual30DayDelta > targetDelta)
  ) {
    status = 'ahead';
  } else {
    status = 'behind';
  }

  const planStartDate = firstWeightRow?.loggedDate ?? endKey;

  return {
    weeklyRate,
    totalDelta,
    planStartDate,
    status,
    rollingAvg: { start: rollingAvgStart, end: rollingAvgEnd },
    currentWeight,
    proteinDays,
  };
}
