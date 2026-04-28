'use server';

import { and, desc, eq, gte, lt, sql } from 'drizzle-orm';
import { z } from 'zod';
import { requireAuthAndProfile } from '@/lib/auth';
import { db } from '@/lib/db';
import { meals } from '@/lib/db/schema';
import { loadWeightSummaryAction } from '@/lib/actions/weight';
import type {
  DashboardSnapshot,
  MealEntry,
  NutritionData,
  StatsData,
  TimeRange,
  VerdictData,
} from '@/components/dashboard/types';
import type { WeightSummaryData } from '@/lib/types/weight';

const dashboardSnapshotSchema = z.object({
  range: z.enum(['30d', '90d']),
  timezoneOffset: z.number().int().min(-840).max(720),
});

interface DashboardProfileContext {
  goal: string | null;
  calorieTarget: number | null;
  proteinTargetG: number | null;
  carbsTargetG: number | null;
  fatTargetG: number | null;
}

interface DashboardMealRow {
  id: string;
  rawInput: string;
  loggedAt: Date;
  localDate: string;
  caloriesKcal: number | null;
  proteinG: number | null;
  carbohydrateG: number | null;
  fatG: number | null;
}

interface DailyNutritionTotals {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  mealCount: number;
}

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

function getWeeklyRate(goal: string | null): number {
  if (goal === 'bulking') return 0.25;
  if (goal === 'cutting') return -0.4;
  return 0;
}

function getGoalDirection(goal: string | null) {
  if (goal === 'bulking') return 'up' as const;
  if (goal === 'cutting') return 'down' as const;
  return 'flat' as const;
}

function toNumber(value: number | string | null | undefined): number {
  if (value == null) return 0;
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function roundToTenth(value: number): number {
  return Math.round(value * 10) / 10;
}

function getWeekStart(dateString: string): string {
  const date = new Date(`${dateString}T00:00:00.000Z`);
  const day = date.getUTCDay();
  const diffToMon = day === 0 ? -6 : 1 - day;
  date.setUTCDate(date.getUTCDate() + diffToMon);
  return date.toISOString().slice(0, 10);
}

function getDailyTotalsMap(rows: DashboardMealRow[]) {
  const totals = new Map<string, DailyNutritionTotals>();

  for (const row of rows) {
    const existing = totals.get(row.localDate) ?? {
      calories: 0,
      protein: 0,
      carbs: 0,
      fat: 0,
      mealCount: 0,
    };

    existing.calories += toNumber(row.caloriesKcal);
    existing.protein += toNumber(row.proteinG);
    existing.carbs += toNumber(row.carbohydrateG);
    existing.fat += toNumber(row.fatG);
    existing.mealCount += 1;
    totals.set(row.localDate, existing);
  }

  return totals;
}

function getDailyTotals(
  totals: Map<string, DailyNutritionTotals>,
  dateString: string
): DailyNutritionTotals {
  return (
    totals.get(dateString) ?? {
      calories: 0,
      protein: 0,
      carbs: 0,
      fat: 0,
      mealCount: 0,
    }
  );
}

function buildHeatmap(
  totals: Map<string, DailyNutritionTotals>,
  proteinTarget: number,
  range: TimeRange,
  currentWeekStart: string
): (number | null)[][] {
  const weekCount = range === '30d' ? 4 : 13;
  const startWeek = shiftDate(currentWeekStart, -(weekCount - 1) * 7);

  return Array.from({ length: 7 }, (_, dayIndex) =>
    Array.from({ length: weekCount }, (_, weekIndex) => {
      const weekStart = shiftDate(startWeek, weekIndex * 7);
      const dateString = shiftDate(weekStart, dayIndex);
      const daily = totals.get(dateString);
      if (!daily || daily.mealCount === 0 || proteinTarget <= 0) {
        return null;
      }

      return daily.protein / proteinTarget;
    })
  );
}

function buildProteinDays(
  totals: Map<string, DailyNutritionTotals>,
  proteinTarget: number,
  currentWeekStart: string
): VerdictData['proteinDays'] {
  return Array.from({ length: 7 }, (_, dayIndex) => {
    const dateString = shiftDate(currentWeekStart, dayIndex);
    const daily = totals.get(dateString);
    if (!daily || proteinTarget <= 0) return false;
    return daily.protein >= proteinTarget;
  }) as VerdictData['proteinDays'];
}

function resolvePaceStatus(input: {
  goalDirection: ReturnType<typeof getGoalDirection>;
  actualDelta: number;
  expectedDelta: number;
  weightCount: number;
}): VerdictData['status'] {
  if (input.weightCount < 2) return 'too_early';

  const diff = input.actualDelta - input.expectedDelta;
  const tolerance = 0.2;

  if (Math.abs(diff) <= tolerance) return 'on_pace';

  if (input.goalDirection === 'down') {
    return diff < 0 ? 'ahead' : 'behind';
  }

  if (input.goalDirection === 'up') {
    return diff > 0 ? 'ahead' : 'behind';
  }

  return Math.abs(input.actualDelta) <= tolerance
    ? 'on_pace'
    : input.actualDelta > 0
      ? 'behind'
      : 'ahead';
}

function countLoggedDays(
  totals: Map<string, DailyNutritionTotals>,
  endDate: string,
  lookbackDays: number
): number {
  let count = 0;
  for (let delta = 0; delta < lookbackDays; delta += 1) {
    const dateString = shiftDate(endDate, -delta);
    if ((totals.get(dateString)?.mealCount ?? 0) > 0) {
      count += 1;
    }
  }
  return count;
}

function countStreak(
  totals: Map<string, DailyNutritionTotals>,
  endDate: string
): number {
  let streak = 0;
  for (let delta = 0; delta < 365; delta += 1) {
    const dateString = shiftDate(endDate, -delta);
    if ((totals.get(dateString)?.mealCount ?? 0) > 0) {
      streak += 1;
      continue;
    }
    break;
  }
  return streak;
}

function buildSnapshot(input: {
  range: TimeRange;
  todayDate: string;
  profile: DashboardProfileContext;
  weightSummary: WeightSummaryData;
  mealRows: DashboardMealRow[];
}): DashboardSnapshot {
  const { range, todayDate, profile, weightSummary, mealRows } = input;
  const calorieTarget = profile.calorieTarget ?? 1800;
  const proteinTarget = profile.proteinTargetG ?? 140;
  const carbTarget = profile.carbsTargetG ?? 180;
  const fatTarget = profile.fatTargetG ?? 60;

  const totals = getDailyTotalsMap(mealRows);
  const todayTotals = getDailyTotals(totals, todayDate);
  const currentWeekStart = getWeekStart(todayDate);
  const rangeDays = range === '30d' ? 30 : 90;
  const rangeStartDate = shiftDate(todayDate, -(rangeDays - 1));
  const currentMeals = mealRows
    .filter((row) => row.localDate === todayDate)
    .sort((a, b) => b.loggedAt.getTime() - a.loggedAt.getTime())
    .map((row) => ({
      id: row.id,
      label: row.rawInput,
      calories: Math.round(toNumber(row.caloriesKcal)),
    }));

  const weeklyRate = getWeeklyRate(profile.goal);
  const goalDirection = getGoalDirection(profile.goal);
  const actualDelta = roundToTenth(
    weightSummary.currentWeight - weightSummary.periodStartWeight
  );
  const expectedDelta = roundToTenth(
    weightSummary.expectedEndWeight - weightSummary.periodStartWeight
  );
  const verdict: VerdictData = {
    weeklyRate,
    totalDelta: actualDelta,
    planStartDate: rangeStartDate,
    status: resolvePaceStatus({
      goalDirection,
      actualDelta,
      expectedDelta,
      weightCount: weightSummary.weights.length,
    }),
    rollingAvg: {
      start: roundToTenth(weightSummary.periodStartWeight),
      end: roundToTenth(weightSummary.currentWeight),
    },
    currentWeight: roundToTenth(weightSummary.currentWeight),
    proteinDays: buildProteinDays(totals, proteinTarget, currentWeekStart),
  };

  const avgCaloriesLast7Days = Array.from({ length: 7 }, (_, delta) => {
    const dateString = shiftDate(todayDate, -delta);
    return getDailyTotals(totals, dateString).calories;
  }).reduce((sum, value) => sum + value, 0) / 7;

  const stats: StatsData = {
    streak: countStreak(totals, todayDate),
    daysLogged: countLoggedDays(totals, todayDate, rangeDays),
    avgDeficit: Math.round(calorieTarget - avgCaloriesLast7Days),
    todayWeight: weightSummary.todayWeight,
    weightPlaceholder: weightSummary.currentWeight,
  };

  const nutrition: NutritionData = {
    calories: {
      current: Math.round(todayTotals.calories),
      target: calorieTarget,
    },
    protein: {
      current: Math.round(todayTotals.protein),
      target: proteinTarget,
    },
    carbs: {
      current: Math.round(todayTotals.carbs),
      target: carbTarget,
    },
    fat: {
      current: Math.round(todayTotals.fat),
      target: fatTarget,
    },
  };

  return {
    verdict,
    stats,
    nutrition,
    meals: currentMeals,
    heatmap: buildHeatmap(totals, proteinTarget, range, currentWeekStart),
    weightSummary,
  };
}

async function loadMealRowsForRange(input: {
  range: TimeRange;
  timezoneOffset: number;
  todayDate: string;
  userId: string;
}): Promise<DashboardMealRow[]> {
  const { range, timezoneOffset, todayDate, userId } = input;
  const rangeDays = range === '30d' ? 30 : 90;
  const rangeStartDate = shiftDate(todayDate, -(rangeDays - 1));
  const rangeEndDate = shiftDate(todayDate, 1);
  const offsetMins = -timezoneOffset;
  const rangeStartUtc = new Date(`${rangeStartDate}T00:00:00.000Z`);
  rangeStartUtc.setTime(
    rangeStartUtc.getTime() + timezoneOffset * 60 * 1000
  );
  const rangeEndUtc = new Date(`${rangeEndDate}T00:00:00.000Z`);
  rangeEndUtc.setTime(rangeEndUtc.getTime() + timezoneOffset * 60 * 1000);
  const localDateExpr = sql<string>`DATE(${meals.loggedAt} + (${sql.raw(
    String(offsetMins)
  )}::integer * INTERVAL '1 minute'))`;

  const rows = await db
    .select({
      id: meals.id,
      rawInput: meals.rawInput,
      loggedAt: meals.loggedAt,
      localDate: localDateExpr.as('localDate'),
      caloriesKcal: meals.caloriesKcal,
      proteinG: meals.proteinG,
      carbohydrateG: meals.carbohydrateG,
      fatG: meals.fatG,
    })
    .from(meals)
    .where(
      and(
        eq(meals.userId, userId),
        gte(meals.loggedAt, rangeStartUtc),
        lt(meals.loggedAt, rangeEndUtc)
      )
    )
    .orderBy(desc(meals.loggedAt));

  return rows;
}

export async function loadDashboardSnapshotAction(input: {
  range: TimeRange;
  timezoneOffset: number;
}): Promise<DashboardSnapshot> {
  const parsed = dashboardSnapshotSchema.parse(input);
  const { user, profile } = await requireAuthAndProfile();
  const todayDate = toLocalDateString(new Date(), parsed.timezoneOffset);

  const [weightSummary, mealRows] = await Promise.all([
    loadWeightSummaryAction({
      range: parsed.range,
      timezoneOffset: parsed.timezoneOffset,
    }),
    loadMealRowsForRange({
      range: parsed.range,
      timezoneOffset: parsed.timezoneOffset,
      todayDate,
      userId: user.id,
    }),
  ]);

  return buildSnapshot({
    range: parsed.range,
    todayDate,
    profile: {
      goal: profile.goal,
      calorieTarget: profile.calorieTarget,
      proteinTargetG: profile.proteinTargetG,
      carbsTargetG: profile.carbsTargetG,
      fatTargetG: profile.fatTargetG,
    },
    weightSummary,
    mealRows,
  });
}
