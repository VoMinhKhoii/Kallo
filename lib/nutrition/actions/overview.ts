'use server';

import { requireAuthAndProfile } from '@/lib/auth';
import { getNutritionPeriod } from '../date-range';
import { nutritionOverviewInputSchema } from '../schemas';
import { resolveInitialRange } from '../summary';
import type { NutritionOverview } from '../types';
import { mapOverviewRowsToDto } from './overview-mapper';
import { countLoggedDaysLast30, fetchOverviewRows } from './overview-query';

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
  const last30Bounds = getInclusiveUtcBounds(
    last30Period,
    parsed.timezoneOffset
  );
  const loggedDaysLast30 = await countLoggedDaysLast30({
    userId: user.id,
    startDate: last30Period.startDate,
    endDate: last30Period.endDate,
    startAt: last30Bounds.startAt,
    endAt: last30Bounds.endAt,
    timezoneOffset: parsed.timezoneOffset,
  });
  const resolvedRange =
    parsed.range === 'auto'
      ? resolveInitialRange(loggedDaysLast30)
      : parsed.range;
  const period = getNutritionPeriod({
    range: resolvedRange,
    timezoneOffset: parsed.timezoneOffset,
  });
  const bounds = getInclusiveUtcBounds(period, parsed.timezoneOffset);
  const rows = await fetchOverviewRows({
    userId: user.id,
    startDate: period.startDate,
    endDate: period.endDate,
    startAt: bounds.startAt,
    endAt: bounds.endAt,
    timezoneOffset: parsed.timezoneOffset,
  });
  const overview = mapOverviewRowsToDto({
    rows,
    profile,
    requestedRange: parsed.range,
    resolvedRange,
    loggedDaysLast30,
    period,
  });

  assertOverviewHasNoTrendArrays(overview);
  return overview;
}
