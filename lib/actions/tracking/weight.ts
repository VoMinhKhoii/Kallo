'use server';

import { and, desc, eq, gte, lte } from 'drizzle-orm';
import { z } from 'zod';
import {
  dayKeyToUtcDate,
  toLocalDayKey,
  toUtcDayKey,
} from '@/lib/core/date/day-key';
import { MS_PER_DAY } from '@/lib/core/date/ms';
import { Errors } from '@/lib/core/errors/catalog';
import type { WeightRange, WeightSummaryData } from '@/lib/core/types/weight';
import {
  dateStringSchema,
  timezoneOffsetSchema,
} from '@/lib/core/validation/primitives';
import { weightLogSchema } from '@/lib/core/validation/weight';
import { buildWeightTrendSummary } from '@/lib/domain/dashboard/weight-trend';
import { requireAuthAndProfile } from '@/lib/infra/auth/session';
import { db } from '@/lib/infra/db';
import { bodyWeightLog, userProfiles } from '@/lib/infra/db/schema';

const weightRangeSchema = z.object({
  range: z.enum(['30d', '90d']),
  timezoneOffset: timezoneOffsetSchema,
});

const deleteWeightSchema = z.object({
  loggedDate: dateStringSchema,
});

function shiftDate(dateString: string, deltaDays: number): string {
  const date = dayKeyToUtcDate(dateString);
  date.setUTCDate(date.getUTCDate() + deltaDays);
  return toUtcDayKey(date);
}

/** Inclusive-ish span between two day keys, floored at 1 — a single logged day
 *  still counts as a day of elapsed plan. */
function daysBetween(startDate: string, endDate: string): number {
  const start = dayKeyToUtcDate(startDate);
  const end = dayKeyToUtcDate(endDate);
  return Math.max(
    1,
    Math.round((end.getTime() - start.getTime()) / MS_PER_DAY)
  );
}

function toNumber(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function getWeeklyRate(goal: string | null): number {
  if (goal === 'bulking') return 0.25;
  if (goal === 'cutting') return -0.4;
  return 0;
}

export async function logWeightAction(input: {
  loggedDate: string;
  weightKg: number;
}) {
  const parsed = weightLogSchema.parse(input);
  const { user } = await requireAuthAndProfile();

  return await db.transaction(async (tx) => {
    const [saved] = await tx
      .insert(bodyWeightLog)
      .values({
        userId: user.id,
        loggedDate: parsed.loggedDate,
        weightKg: String(parsed.weightKg),
      })
      .onConflictDoUpdate({
        target: [bodyWeightLog.userId, bodyWeightLog.loggedDate],
        set: { weightKg: String(parsed.weightKg) },
      })
      .returning({
        loggedDate: bodyWeightLog.loggedDate,
        weightKg: bodyWeightLog.weightKg,
      });

    const [latestRemaining] = await tx
      .select({ weightKg: bodyWeightLog.weightKg })
      .from(bodyWeightLog)
      .where(eq(bodyWeightLog.userId, user.id))
      .orderBy(desc(bodyWeightLog.loggedDate), desc(bodyWeightLog.createdAt))
      .limit(1);

    await tx
      .update(userProfiles)
      .set({
        weightKg:
          latestRemaining && latestRemaining.weightKg !== null
            ? String(latestRemaining.weightKg)
            : null,
        updatedAt: new Date(),
      })
      .where(eq(userProfiles.userId, user.id));

    return {
      success: true as const,
      loggedDate: saved.loggedDate,
      weightKg: toNumber(saved.weightKg) ?? parsed.weightKg,
    };
  });
}

export async function deleteWeightLogAction(input: { loggedDate: string }) {
  const parsed = deleteWeightSchema.parse(input);
  const { user } = await requireAuthAndProfile();

  return await db.transaction(async (tx) => {
    const [deleted] = await tx
      .delete(bodyWeightLog)
      .where(
        and(
          eq(bodyWeightLog.userId, user.id),
          eq(bodyWeightLog.loggedDate, parsed.loggedDate)
        )
      )
      .returning({ loggedDate: bodyWeightLog.loggedDate });

    if (!deleted) {
      throw Errors.validationFailed(
        'Không tìm thấy cân nặng của ngày này để xoá.'
      );
    }

    const [latestRemaining] = await tx
      .select({ weightKg: bodyWeightLog.weightKg })
      .from(bodyWeightLog)
      .where(eq(bodyWeightLog.userId, user.id))
      .orderBy(desc(bodyWeightLog.loggedDate), desc(bodyWeightLog.createdAt))
      .limit(1);

    await tx
      .update(userProfiles)
      .set({
        weightKg:
          latestRemaining && latestRemaining.weightKg !== null
            ? String(latestRemaining.weightKg)
            : null,
        updatedAt: new Date(),
      })
      .where(eq(userProfiles.userId, user.id));

    return { success: true as const, loggedDate: deleted.loggedDate };
  });
}

export async function loadWeightSummaryAction(input: {
  range: WeightRange;
  timezoneOffset: number;
}): Promise<WeightSummaryData> {
  const parsed = weightRangeSchema.parse(input);
  const { user, profile } = await requireAuthAndProfile();

  const todayDate = toLocalDayKey(new Date(), parsed.timezoneOffset);
  const rangeDays = parsed.range === '30d' ? 30 : 90;
  const startDate = shiftDate(todayDate, -(rangeDays - 1));

  const rows = await db
    .select({
      loggedDate: bodyWeightLog.loggedDate,
      weightKg: bodyWeightLog.weightKg,
    })
    .from(bodyWeightLog)
    .where(
      and(
        eq(bodyWeightLog.userId, user.id),
        gte(bodyWeightLog.loggedDate, startDate),
        lte(bodyWeightLog.loggedDate, todayDate)
      )
    )
    .orderBy(bodyWeightLog.loggedDate);

  const [latestOverall] = await db
    .select({
      loggedDate: bodyWeightLog.loggedDate,
      weightKg: bodyWeightLog.weightKg,
    })
    .from(bodyWeightLog)
    .where(eq(bodyWeightLog.userId, user.id))
    .orderBy(desc(bodyWeightLog.loggedDate), desc(bodyWeightLog.createdAt))
    .limit(1);

  const profileWeight = toNumber(profile.weightKg);
  const currentWeight =
    toNumber(latestOverall?.weightKg) ?? profileWeight ?? 65;
  const todayWeightRow = rows.find((row) => row.loggedDate === todayDate);
  const todayWeight = toNumber(todayWeightRow?.weightKg);
  // Logged points, kept as parallel arrays: `weights` stays a bare number[]
  // for existing consumers while `weightDates` carries the calendar day each
  // point belongs to (charts label their x axis from it).
  const loggedPoints = rows
    .map((row) => ({ date: row.loggedDate, weight: toNumber(row.weightKg) }))
    .filter(
      (point): point is { date: string; weight: number } =>
        point.weight !== null
    );
  const weights = loggedPoints.map((point) => point.weight);
  const weightDates = loggedPoints.map((point) => point.date);

  const periodStartWeight = weights[0] ?? currentWeight;
  const firstRangeRow = rows[0];
  const lastRangeRow = rows[rows.length - 1];
  const periodElapsedDays =
    firstRangeRow && lastRangeRow
      ? daysBetween(firstRangeRow.loggedDate, lastRangeRow.loggedDate)
      : null;
  const weeklyRate = getWeeklyRate(profile.goal);
  const weeks = parsed.range === '30d' ? 4.3 : 12.9;
  const expectedEndWeight = periodStartWeight + weeklyRate * weeks;
  const goalDirection =
    profile.goal === 'bulking'
      ? 'up'
      : profile.goal === 'cutting'
        ? 'down'
        : 'flat';

  // Projection is a property of the summary, computed once here so web and
  // mobile both render the forecast from identical numbers.
  const { projectedEndWeight, canProject } = buildWeightTrendSummary({
    weights,
    periodStartWeight,
    expectedEndWeight,
    goalDirection,
    range: parsed.range,
    elapsedDays: periodElapsedDays,
  });

  return {
    range: parsed.range,
    weights,
    weightDates,
    currentWeight,
    todayWeight,
    weightPlaceholder: currentWeight,
    daysLogged: rows.length,
    periodStartWeight,
    expectedEndWeight,
    goalDirection,
    periodElapsedDays,
    projectedEndWeight,
    canProject,
  };
}
