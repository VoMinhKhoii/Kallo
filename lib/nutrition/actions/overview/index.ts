'use server';

import { requireAuthAndProfile } from '@/lib/auth';
import { getNutritionPeriod } from '../../pattern/date-range';
import { resolveInitialRange } from '../../pattern/summary';
import { nutritionOverviewInputSchema } from '../../schemas';
import type { NutritionOverview } from '../../types';
import { mapOverviewRowsToDto } from './mapper';
import { countLoggedDaysLast30, fetchOverviewRows } from './query';

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
    rows = await fetchOverviewRows({
      userId: user.id,
      startDate: period.startDate,
      endDate: period.endDate,
      startAt: bounds.startAt,
      exclusiveEndAt: bounds.exclusiveEndAt,
      timezoneOffset: parsed.timezoneOffset,
    });
    const overview = mapOverviewRowsToDto({
      rows,
      profile,
      requestedRange: parsed.range,
      resolvedRange,
      loggedDaysLast30,
      period,
      dayScope: parsed.days,
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
  [loggedDaysLast30, rows] = await Promise.all([
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
  ]);

  const overview = mapOverviewRowsToDto({
    rows,
    profile,
    requestedRange: parsed.range,
    resolvedRange,
    loggedDaysLast30,
    period,
    dayScope: parsed.days,
  });

  assertOverviewHasNoTrendArrays(overview);
  return overview;
}
