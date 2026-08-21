'use server';

import { getUtcDayRangeForLocalDate } from '@/lib/core/date/local-day';
import { checkFeatureGate } from '@/lib/domain/billing/feature-gate';
import { requireAuthAndProfile } from '@/lib/infra/auth/session';
import {
  getNutritionPeriod,
  getPreviousPeriod,
} from '../../pattern/date-range';
import { resolveInitialRange } from '../../pattern/summary';
import { stripMicronutrients } from '../../premium-scope';
import { nutritionOverviewInputSchema } from '../../schemas';
import type {
  NutritionDayScope,
  NutritionOverview,
  NutritionRangeInput,
} from '../../types';
import { buildCalorieAverages } from './calorie-averages';
import { mapOverviewRowsToDto } from './mapper';
import {
  countLoggedDaysLast30,
  fetchDailyCalorieTotals,
  fetchOverviewRows,
} from './query';
import { type NutritionProfile, nullableNumber } from './row-metrics';

interface UtcBounds {
  startAt: Date;
  exclusiveEndAt: Date;
}

function getUtcBounds(
  period: { startDate: string; endDate: string },
  timezoneOffset: number | null
): UtcBounds {
  // A null offset means "bucket in UTC", which is the zero shift.
  const offset = timezoneOffset ?? 0;

  return {
    startAt: getUtcDayRangeForLocalDate(period.startDate, offset).dayStart,
    exclusiveEndAt: getUtcDayRangeForLocalDate(period.endDate, offset).dayEnd,
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
 * only way to know the previous window is to read it. It reads a per-day
 * calorie aggregate rather than the full item rows — the same index and
 * predicate as the main fetch, one column and a fraction of the rows — and is
 * scored by the same `buildCalorieAverages` the current window uses.
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
  const dayTotals = await fetchDailyCalorieTotals({
    userId,
    startDate: previous.startDate,
    endDate: previous.endDate,
    startAt: bounds.startAt,
    exclusiveEndAt: bounds.exclusiveEndAt,
    timezoneOffset,
  });
  return buildCalorieAverages(dayTotals, calorieTarget);
}

/**
 * Read a resolved range's window — its rows, the window before it, and the
 * pending last-30 count — and map the DTO.
 *
 * Takes the count as a PROMISE rather than a number so it can join the same
 * `Promise.all`: a pinned range never needed the count to decide anything, so
 * it should not wait on it, while `auto` has already awaited it to pick the
 * range and awaiting a settled promise again costs nothing.
 */
async function buildOverview({
  userId,
  profile,
  requestedRange,
  resolvedRange,
  timezoneOffset,
  dayScope,
  loggedDaysLast30,
}: {
  userId: string;
  profile: NutritionProfile;
  requestedRange: NutritionRangeInput;
  resolvedRange: NutritionOverview['resolvedRange'];
  timezoneOffset: number | null;
  dayScope: NutritionDayScope | undefined;
  loggedDaysLast30: Promise<number>;
}): Promise<NutritionOverview> {
  const period = getNutritionPeriod({ range: resolvedRange, timezoneOffset });
  const bounds = getUtcBounds(period, timezoneOffset);
  const calorieTarget = nullableNumber(profile.calorieTarget);

  const [rows, previousCalorieAverages, dayCount] = await Promise.all([
    fetchOverviewRows({
      userId,
      startDate: period.startDate,
      endDate: period.endDate,
      startAt: bounds.startAt,
      exclusiveEndAt: bounds.exclusiveEndAt,
      timezoneOffset,
    }),
    fetchPreviousCalorieAverages({
      userId,
      period,
      timezoneOffset,
      calorieTarget,
    }),
    loggedDaysLast30,
  ]);

  const overview = mapOverviewRowsToDto({
    rows,
    profile,
    requestedRange,
    resolvedRange,
    loggedDaysLast30: dayCount,
    period,
    dayScope,
    previousCalorieAverages,
  });

  assertOverviewHasNoTrendArrays(overview);
  return overview;
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

  // Started before the window queries so the entitlement read (when
  // enforcement is on at all) overlaps them instead of adding a round trip.
  const gatePromise = checkFeatureGate(
    { userId: user.id, profileCreatedAt: profile.createdAt },
    'micronutrients'
  );
  // It is only awaited AFTER `buildOverview`, so a window-query failure would
  // leave this one rejecting with nobody listening — an unhandled rejection
  // that can take the process down. A detached no-op observer marks it handled
  // without consuming it: `gatePromise` itself is still awaited below, so both
  // its result and its rejection continue to propagate normally.
  gatePromise.catch(() => {});

  // Start the count and hold the promise: it only ever gates which range to
  // use, so `auto` awaits it here and a pinned range lets it run alongside the
  // window fetch inside `buildOverview`.
  const loggedDaysLast30 = countLoggedDaysLast30({
    userId: user.id,
    startDate: last30Period.startDate,
    endDate: last30Period.endDate,
    startAt: last30Bounds.startAt,
    exclusiveEndAt: last30Bounds.exclusiveEndAt,
    timezoneOffset: parsed.timezoneOffset,
  });

  const overview = await buildOverview({
    userId: user.id,
    profile,
    requestedRange: parsed.range,
    resolvedRange:
      parsed.range === 'auto'
        ? resolveInitialRange(await loggedDaysLast30)
        : parsed.range,
    timezoneOffset: parsed.timezoneOffset,
    dayScope: parsed.days,
    loggedDaysLast30,
  });

  // Applies to the empty-data overview too (it is built by the same mapper),
  // so a locked viewer with nothing logged still gets the lock card.
  const gate = await gatePromise;
  return gate.locked ? stripMicronutrients(overview) : overview;
}
