'use server';

import { and, asc, eq, gte, lt, sql } from 'drizzle-orm';
import { z } from 'zod';
import { requireAuthAndProfile } from '@/lib/auth';
import {
  buildCalorieAdherenceHeatmap,
  getLocalDateKey,
} from '@/lib/dashboard/adherence';
import { db } from '@/lib/db';
import { meals } from '@/lib/db/schema';

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
