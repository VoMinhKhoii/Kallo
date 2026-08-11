'use server';

import { requireAuthAndProfile } from '@/lib/auth';
import {
  getNutritionPeriod,
  getPreviousPeriod,
} from '../../pattern/date-range';
import { resolveInitialRange } from '../../pattern/summary';
import { nutritionOverviewInputSchema } from '../../schemas';
import type { NutritionOverview } from '../../types';
import { buildCalorieAverages } from './calorie-averages';
import { mapOverviewRowsToDto } from './mapper';
import { countLoggedDaysLast30, fetchOverviewRows } from './query';
import { nullableNumber } from './row-metrics';

interface UtcBounds {
  startAt: Date;
  exclusiveEndAt: Date;
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

function getUtcBounds(
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
    exclusiveEndAt: new Date(exclusiveEnd),
  };
}

function assertOverviewHasNoTrendArrays(overview: NutritionOverview): void {
  for (const card of [...overview.micronutrients, ...overview.moreNutrients]) {
    if ('trend' in card) {
      throw new Error('Nutrition overview must not include trend arrays.');
    }
  }
}

/**
 * Both calorie averages for the equal-length window immediately before
 * [period] — what the card's up/down figure is measured against.
 *
 * A second query, deliberately: the delta compares like with like, and the
 * only way to know the previous window is to read it. It is scored by the same
 * `buildCalorieAverages` the current window uses.
 */
async function fetchPreviousCalorieAverages({
  userId,
  period,
  timezoneOffset,
  calorieTarget,
}: {
  userId: string;
  period: { startDate: string; endDate: string };
  timezoneOffset: number | null;
  calorieTarget: number | null;
}) {
  const previous = getPreviousPeriod(period);
  const bounds = getUtcBounds(previous, timezoneOffset);
  const rows = await fetchOverviewRows({
    userId,
    startDate: previous.startDate,
    endDate: previous.endDate,
    startAt: bounds.startAt,
    exclusiveEndAt: bounds.exclusiveEndAt,
    timezoneOffset,
  });
  return buildCalorieAverages(rows, calorieTarget);
}

export async function getNutritionOverview(
  input: unknown
): Promise<NutritionOverview> {
  const parsed = nutritionOverviewInputSchema.parse(input);
  const { user, profile } = await requireAuthAndProfile();
  const last30Period = getNutritionPeriod({
    range: '30d',
    timezoneOffset: parsed.timezoneOffset,
  });
  const last30Bounds = getUtcBounds(last30Period, parsed.timezoneOffset);

  // When the caller pinned a range, we don't need the last-30 day count to
  // resolve which range to use — fetch both in parallel. When range='auto',
  // the count gates the second query so they stay sequential.
  let loggedDaysLast30: number;
  let resolvedRange: NutritionOverview['resolvedRange'];
  let rows: Awaited<ReturnType<typeof fetchOverviewRows>>;

  if (parsed.range === 'auto') {
    loggedDaysLast30 = await countLoggedDaysLast30({
      userId: user.id,
      startDate: last30Period.startDate,
      endDate: last30Period.endDate,
      startAt: last30Bounds.startAt,
      exclusiveEndAt: last30Bounds.exclusiveEndAt,
      timezoneOffset: parsed.timezoneOffset,
    });
    resolvedRange = resolveInitialRange(loggedDaysLast30);
    const period = getNutritionPeriod({
      range: resolvedRange,
      timezoneOffset: parsed.timezoneOffset,
    });
    const bounds = getUtcBounds(period, parsed.timezoneOffset);
    const [autoRows, previousCalorieAverages] = await Promise.all([
      fetchOverviewRows({
        userId: user.id,
        startDate: period.startDate,
        endDate: period.endDate,
        startAt: bounds.startAt,
        exclusiveEndAt: bounds.exclusiveEndAt,
        timezoneOffset: parsed.timezoneOffset,
      }),
      fetchPreviousCalorieAverages({
        userId: user.id,
        period,
        timezoneOffset: parsed.timezoneOffset,
        calorieTarget: nullableNumber(profile.calorieTarget),
      }),
    ]);
    rows = autoRows;
    const overview = mapOverviewRowsToDto({
      rows,
      profile,
      requestedRange: parsed.range,
      resolvedRange,
      loggedDaysLast30,
      period,
      dayScope: parsed.days,
      previousCalorieAverages,
    });
    assertOverviewHasNoTrendArrays(overview);
    return overview;
  }

  resolvedRange = parsed.range;
  const period = getNutritionPeriod({
    range: resolvedRange,
    timezoneOffset: parsed.timezoneOffset,
  });
  const bounds = getUtcBounds(period, parsed.timezoneOffset);
  let previousCalorieAverages: NutritionOverview['previousCalorieAverages'];
  [loggedDaysLast30, rows, previousCalorieAverages] = await Promise.all([
    countLoggedDaysLast30({
      userId: user.id,
      startDate: last30Period.startDate,
      endDate: last30Period.endDate,
      startAt: last30Bounds.startAt,
      exclusiveEndAt: last30Bounds.exclusiveEndAt,
      timezoneOffset: parsed.timezoneOffset,
    }),
    fetchOverviewRows({
      userId: user.id,
      startDate: period.startDate,
      endDate: period.endDate,
      startAt: bounds.startAt,
      exclusiveEndAt: bounds.exclusiveEndAt,
      timezoneOffset: parsed.timezoneOffset,
    }),
    fetchPreviousCalorieAverages({
      userId: user.id,
      period,
      timezoneOffset: parsed.timezoneOffset,
      calorieTarget: nullableNumber(profile.calorieTarget),
    }),
  ]);

  const overview = mapOverviewRowsToDto({
    rows,
    profile,
    requestedRange: parsed.range,
    resolvedRange,
    loggedDaysLast30,
    period,
    dayScope: parsed.days,
    previousCalorieAverages,
  });

  assertOverviewHasNoTrendArrays(overview);
  return overview;
}
