'use server';

import { and, asc, desc, eq, gte, lt, sql } from 'drizzle-orm';
import { z } from 'zod';
import { requireAuthAndProfile } from '@/lib/auth';
import {
  buildCalorieAdherenceHeatmap,
  getLocalDateKey,
} from '@/lib/dashboard/adherence';
import { db } from '@/lib/db';
import { bodyWeightLog, meals } from '@/lib/db/schema';
import { loadWeightSummaryAction } from './weight';
import type { VerdictData } from '@/components/dashboard/types';

const loadCalorieAdherenceHeatmapSchema = z.object({
  range: z.enum(['30d', '90d']),
  timezoneOffset: z.number().int().min(-840).max(720),
});

const RANGE_DAYS = {
  '30d': 30,
  '90d': 90,
} as const;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * MS_PER_DAY);
}

function dateKeyToUtcDate(dateKey: string): Date {
  return new Date(`${dateKey}T00:00:00.000Z`);
}

function getUtcBoundaryForLocalDate(
  dateKey: string,
  timezoneOffset: number
): Date {
  const boundary = dateKeyToUtcDate(dateKey);
  boundary.setTime(boundary.getTime() + timezoneOffset * 60 * 1000);
  return boundary;
}

export async function loadCalorieAdherenceHeatmap(input: {
  range: '30d' | '90d';
  timezoneOffset: number;
}): Promise<(number | null)[][]> {
  const parsed = loadCalorieAdherenceHeatmapSchema.parse(input);
  const { user, profile } = await requireAuthAndProfile();

  const now = new Date();
  const endKey = getLocalDateKey(now, parsed.timezoneOffset);
  const endDate = dateKeyToUtcDate(endKey);
  const startDate = addDays(endDate, -(RANGE_DAYS[parsed.range] - 1));
  const startKey = startDate.toISOString().slice(0, 10);
  const nextEndKey = addDays(endDate, 1).toISOString().slice(0, 10);

  const utcStart = getUtcBoundaryForLocalDate(startKey, parsed.timezoneOffset);
  const utcEnd = getUtcBoundaryForLocalDate(nextEndKey, parsed.timezoneOffset);
  const offsetMins = -parsed.timezoneOffset;
  const localDateExpr = sql<string>`DATE(${meals.loggedAt} + (${sql.raw(String(offsetMins))}::integer * INTERVAL '1 minute'))`;
  const caloriesExpr = sql<number>`COALESCE(SUM(${meals.caloriesKcal}), 0)`;

  const dailyCalories = await db
    .select({
      date: localDateExpr.as('date'),
      calories: caloriesExpr.as('calories'),
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

  return buildCalorieAdherenceHeatmap({
    range: parsed.range,
    dailyCalories: dailyCalories.map((day) => ({
      date: day.date,
      calories: Number(day.calories),
    })),
    calorieTarget: profile.calorieTarget,
    timezoneOffset: parsed.timezoneOffset,
    now,
  });
}

export async function loadVerdictAction(input: {
  timezoneOffset: number;
}): Promise<VerdictData> {
  const { user, profile } = await requireAuthAndProfile();
  const timezoneOffset = input.timezoneOffset;

  // Get weight summary for 30d range to calculate verdict
  const weightSummary = await loadWeightSummaryAction({
    range: '30d',
    timezoneOffset,
  });

  // Calculate weekly rate from weights array
  const weights = weightSummary.weights;
  const weeklyRate =
    weights.length >= 7
      ? (weights[weights.length - 1] - weights[0]) / (weights.length / 7)
      : 0;

  // Get first weight entry to determine plan start date
  const firstWeight = await db
    .select({ loggedDate: bodyWeightLog.loggedDate })
    .from(bodyWeightLog)
    .where(eq(bodyWeightLog.userId, user.id))
    .orderBy(asc(bodyWeightLog.loggedDate))
    .limit(1);

  const planStartDate = firstWeight[0]?.loggedDate ?? new Date().toISOString().slice(0, 10);

  // Calculate total delta from first weight to current
  const totalDelta = weightSummary.weights[0] ? weightSummary.currentWeight - weightSummary.weights[0] : 0;

  // Determine status based on pace
  const expectedDelta = weeklyRate > 0 ? weeklyRate * 4.3 : weeklyRate * 4.3; // 4.3 weeks in 30 days
  const status =
    Math.abs(weeklyRate) < 0.1
      ? ('too_early' as const)
      : weeklyRate < expectedDelta
        ? ('behind' as const)
        : weeklyRate > expectedDelta
          ? ('ahead' as const)
          : ('on_pace' as const);

  // Calculate rolling average (first 7 vs last 7 days)
  const rollingAvgStart = weights.slice(0, 7).reduce((a, b) => a + b, 0) / Math.min(7, weights.length);
  const rollingAvgEnd = weights.slice(-7).reduce((a, b) => a + b, 0) / Math.min(7, weights.length);

  // Calculate protein days (last 7 days)
  const now = new Date();
  const todayDate = new Date(now.getTime() + timezoneOffset * 60 * 1000).toISOString().slice(0, 10);
  const proteinDays: [boolean, boolean, boolean, boolean, boolean, boolean, boolean] = [false, false, false, false, false, false, false];

  const last7DaysStart = new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000);
  const offsetMins = -timezoneOffset;
  const localDateExpr = sql<string>`DATE(${meals.loggedAt} + (${sql.raw(String(offsetMins))}::integer * INTERVAL '1 minute'))`;
  const proteinExpr = sql<number>`COALESCE(SUM(${meals.proteinG}), 0)`;

  const dailyProtein = await db
    .select({
      date: localDateExpr.as('date'),
      protein: proteinExpr.as('protein'),
    })
    .from(meals)
    .where(
      and(
        eq(meals.userId, user.id),
        gte(meals.loggedAt, last7DaysStart)
      )
    )
    .groupBy(localDateExpr)
    .orderBy(asc(localDateExpr));

  // Mark protein hits for each day
  const proteinTarget = profile.proteinTargetG ?? 100; // Default to 100g if not set
  dailyProtein.forEach((day) => {
    const dayIndex = new Date(day.date).getDay(); // 0=Sun, 1=Mon...
    const adjustedIndex = dayIndex === 0 ? 6 : dayIndex - 1; // Convert to Mon-Sun (0-6)
    if (Number(day.protein) >= proteinTarget) {
      proteinDays[adjustedIndex] = true;
    }
  });

  return {
    weeklyRate,
    totalDelta,
    planStartDate,
    status,
    rollingAvg: { start: rollingAvgStart, end: rollingAvgEnd },
    currentWeight: weightSummary.currentWeight,
    proteinDays,
  };
}
