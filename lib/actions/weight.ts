'use server';

import { and, desc, eq, gte, lte, sql } from 'drizzle-orm';
import { z } from 'zod';
import { requireAuthAndProfile } from '@/lib/auth';
import { db } from '@/lib/db';
import { bodyWeightLog, userProfiles } from '@/lib/db/schema';
import { Errors } from '@/lib/errors';
import { weightLogSchema } from '@/lib/validation';
import type { WeightRange, WeightSummaryData } from '@/lib/types/weight';

const weightRangeSchema = z.object({
  range: z.enum(['30d', '90d']),
  timezoneOffset: z.number().int().min(-840).max(720),
});

const deleteWeightSchema = z.object({
  loggedDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Ngày phải có dạng YYYY-MM-DD.'),
});

function toLocalDateString(date: Date, timezoneOffset: number): string {
  return new Date(date.getTime() - timezoneOffset * 60 * 1000)
    .toISOString()
    .slice(0, 10);
}

function shiftDate(dateString: string, deltaDays: number): string {
  const date = new Date(`${dateString}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + deltaDays);
  return date.toISOString().slice(0, 10);
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

    await tx
      .update(userProfiles)
      .set({
        weightKg: String(parsed.weightKg),
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

  const [deleted] = await db
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

  return { success: true as const, loggedDate: deleted.loggedDate };
}

export async function loadWeightSummaryAction(input: {
  range: WeightRange;
  timezoneOffset: number;
}): Promise<WeightSummaryData> {
  const parsed = weightRangeSchema.parse(input);
  const { user, profile } = await requireAuthAndProfile();

  const todayDate = toLocalDateString(new Date(), parsed.timezoneOffset);
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
  const weights = rows
    .map((row) => toNumber(row.weightKg))
    .filter((value): value is number => value !== null);

  const periodStartWeight = weights[0] ?? currentWeight;
  const weeklyRate = getWeeklyRate(profile.goal);
  const weeks = parsed.range === '30d' ? 4.3 : 12.9;
  const expectedEndWeight = periodStartWeight + weeklyRate * weeks;
  const goalDirection = profile.goal === 'bulking' ? 'up' : 'down';

  return {
    range: parsed.range,
    weights,
    currentWeight,
    todayWeight,
    weightPlaceholder: currentWeight,
    daysLogged: rows.length,
    periodStartWeight,
    expectedEndWeight,
    goalDirection,
  };
}
