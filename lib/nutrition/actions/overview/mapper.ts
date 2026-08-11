import { DEFAULT_NUTRIENTS } from '../../catalog/nutrients';
import { resolveMicronutrientTargets } from '../../catalog/reference-targets';
import { classifyDayCompleteness } from '../../pattern/completeness';
import type { getNutritionPeriod } from '../../pattern/date-range';
import {
  bucketNutrients,
  getMacroConsistencySummary,
  getTrendStatus,
} from '../../pattern/summary';
import type {
  CalorieAverages,
  NutritionDayScope,
  NutritionNutrientKey,
  NutritionOverview,
  NutritionRangeInput,
} from '../../types';
import { buildDaySeries, RANGE_BUCKET_UNIT } from './day-series';
import { buildMacroPatterns } from './macro-patterns';
import { buildNutrientCards, toSummaryItem } from './nutrient-cards';
import type { OverviewMealItemRow } from './query';
import { type NutritionProfile, nullableNumber, sumRows } from './row-metrics';
import { partitionSpotlight } from './spotlight';

const DEFAULT_NUTRIENT_SET = new Set<NutritionNutrientKey>(DEFAULT_NUTRIENTS);

type NutritionPeriod = ReturnType<typeof getNutritionPeriod>;

interface MapOverviewRowsInput {
  rows: OverviewMealItemRow[];
  profile: NutritionProfile;
  requestedRange: NutritionRangeInput;
  resolvedRange: NutritionOverview['resolvedRange'];
  loggedDaysLast30: number;
  period: NutritionPeriod;
  /**
   * Which day set the body (macros/series/nutrient grid) is averaged over.
   * `undefined` = legacy behavior (complete days with the all-partial safety
   * valve) for the web app; `'complete'` = strict complete days (no valve, may
   * be empty); `'all'` = every logged day. Regardless of this, `calorieAverages`
   * always carries both scopes.
   */
  dayScope?: NutritionDayScope;
}

export function mapOverviewRowsToDto({
  rows,
  profile,
  requestedRange,
  resolvedRange,
  loggedDaysLast30,
  period,
  dayScope,
}: MapOverviewRowsInput): NutritionOverview {
  const loggedDates = new Set(
    rows.filter((row) => row.calories > 0).map((row) => row.localDate)
  );
  const loggedDays = loggedDates.size;

  // When the user has no logged days in the period, return a deterministic
  // zero-state DTO instead of computing averages with a synthetic divisor of
  // 1 (which would silently leak partial-row sums into the UI). The shell
  // gates on `loggedDays === 0` for the empty state, so this just removes a
  // hidden invariant trap from the data layer.
  if (loggedDays === 0) {
    return {
      requestedRange,
      resolvedRange,
      bucketTimezone: period.bucketTimezone,
      loggedDays: 0,
      completeDays: 0,
      partialDays: 0,
      loggedDaysLast30,
      trendStatus: getTrendStatus(resolvedRange, 0),
      period: {
        startDate: period.startDate,
        endDate: period.endDate,
      },
      summary: {
        mostConsistent: [],
        needsAttention: [],
        limitedDataCount: 0,
        macroConsistency: { averageConsistencyPct: 0, weakestMacro: null },
      },
      calorieAverages: {
        all: { averagePerDay: null, days: 0 },
        complete: { averagePerDay: null, days: 0 },
      },
      macros: [],
      daySeries: {
        unit: RANGE_BUCKET_UNIT[resolvedRange],
        series: [],
      },
      micronutrients: [],
      spotlight: [],
      steady: [],
      moreNutrients: [],
      educationCards: [
        {
          id: 'vitamin_d',
          titleKey: 'nutrition.education.vitaminD.title',
          bodyKey: 'nutrition.education.vitaminD.body',
        },
      ],
    };
  }

  // Days where the user logged only a meal or two then forgot drag averages
  // down and read as consistency "misses". Classify each logged day and scope
  // every long-span metric to complete days only; partial days are surfaced
  // via the count below rather than silently skewing the numbers.
  const dayCalories = new Map<string, number>();
  for (const row of rows) {
    if (row.calories <= 0) {
      continue;
    }
    dayCalories.set(
      row.localDate,
      (dayCalories.get(row.localDate) ?? 0) + row.calories
    );
  }
  const dayCalorieList = [...dayCalories].map(([date, calories]) => ({
    date,
    calories,
  }));
  const calorieTarget = nullableNumber(profile.calorieTarget);

  // Strict (no safety-valve) classification: a genuinely under-logged period
  // yields zero complete days. Used for `calorieAverages.complete` and, when the
  // caller asks for the `'complete'` scope, for the whole body too.
  const strict = classifyDayCompleteness(dayCalorieList, calorieTarget, {
    safetyValve: false,
  });

  // Both scopes' calorie averages, shipped regardless of `dayScope` so the
  // client can show one as hero and the other as a subtle secondary and swap
  // them without a refetch.
  const loggedRows = rows.filter((row) => loggedDates.has(row.localDate));
  const strictCompleteRows = rows.filter((row) =>
    strict.completeDates.has(row.localDate)
  );
  const calorieAverages: CalorieAverages = {
    all: {
      averagePerDay:
        loggedDays > 0 ? sumRows(loggedRows, 'calories') / loggedDays : null,
      days: loggedDays,
    },
    complete: {
      averagePerDay:
        strict.completeDays > 0
          ? sumRows(strictCompleteRows, 'calories') / strict.completeDays
          : null,
      days: strict.completeDays,
    },
  };

  // Pick the day set the body (macros/series/grid) averages over. Legacy
  // (`undefined`) keeps the valve so the web app is byte-identical to before;
  // an explicit scope uses the strict classification.
  const legacy =
    dayScope === undefined
      ? classifyDayCompleteness(dayCalorieList, calorieTarget)
      : null;
  const { averagingDates, averagingDayCount, completeDays, partialDays } =
    dayScope === 'all'
      ? {
          averagingDates: loggedDates,
          averagingDayCount: loggedDays,
          completeDays: strict.completeDays,
          partialDays: strict.partialDays,
        }
      : dayScope === 'complete'
        ? {
            averagingDates: strict.completeDates,
            averagingDayCount: strict.completeDays,
            completeDays: strict.completeDays,
            partialDays: strict.partialDays,
          }
        : {
            averagingDates: legacy!.completeDates,
            averagingDayCount: legacy!.completeDays,
            completeDays: legacy!.completeDays,
            partialDays: legacy!.partialDays,
          };

  // No qualifying days — nothing logged at all, or the strict `'complete'`
  // scope with no complete day in the window.
  //
  // The body is still fully populated, at zero. An empty payload used to make
  // the client swap in a separate "nothing here yet" screen, which hid the
  // shape of the page from exactly the people who had not learned it yet. Every
  // nutrient row is present with its real target, a `null` average that renders
  // as "—", and a bar at zero: the page reads the same on day one as on day
  // thirty, just empty.
  if (averagingDayCount === 0) {
    const emptyTargets = resolveMicronutrientTargets(profile);
    const emptyCards = buildNutrientCards({
      rows: [],
      targets: emptyTargets,
      totalCalories: 0,
      // Denominator only — every sum above it is 0. Zero here would divide by
      // zero and put NaN on every card.
      safeLoggedDays: 1,
    }).map((card) => ({
      ...card,
      averagePerDay: null,
      percentOfTarget: null,
    }));
    return {
      requestedRange,
      resolvedRange,
      bucketTimezone: period.bucketTimezone,
      loggedDays,
      completeDays,
      partialDays,
      loggedDaysLast30,
      trendStatus: getTrendStatus(resolvedRange, completeDays),
      period: {
        startDate: period.startDate,
        endDate: period.endDate,
      },
      summary: {
        mostConsistent: [],
        needsAttention: [],
        limitedDataCount: 0,
        macroConsistency: { averageConsistencyPct: 0, weakestMacro: null },
      },
      calorieAverages,
      macros: buildMacroPatterns([], 1, profile),
      daySeries: {
        unit: RANGE_BUCKET_UNIT[resolvedRange],
        series: [],
      },
      micronutrients: emptyCards.filter((card) =>
        DEFAULT_NUTRIENT_SET.has(card.nutrient)
      ),
      spotlight: [],
      steady: [],
      moreNutrients: emptyCards.filter(
        (card) =>
          !DEFAULT_NUTRIENT_SET.has(card.nutrient) &&
          emptyTargets[card.nutrient].applicability !== 'hidden'
      ),
      educationCards: [
        {
          id: 'vitamin_d',
          titleKey: 'nutrition.education.vitaminD.title',
          bodyKey: 'nutrition.education.vitaminD.body',
        },
      ],
    };
  }

  const completeRows = rows.filter((row) => averagingDates.has(row.localDate));

  // safeLoggedDays divides nutrient sums to produce the per-day average over the
  // selected day set. Both numerator (sumRows over completeRows) and denominator
  // (averagingDayCount) are scoped to the same set, so days outside it neither
  // inflate the divisor nor leak their sums into the average.
  const safeLoggedDays = averagingDayCount;
  const totalCalories = completeRows.reduce(
    (sum, row) => sum + Math.max(0, row.calories),
    0
  );
  const targets = resolveMicronutrientTargets(profile);
  const macros = buildMacroPatterns(completeRows, safeLoggedDays, profile);
  const macroConsistency = getMacroConsistencySummary({
    calories:
      macros.find((macro) => macro.key === 'calories')?.consistencyPct ?? null,
    protein:
      macros.find((macro) => macro.key === 'protein')?.consistencyPct ?? null,
    carbohydrate:
      macros.find((macro) => macro.key === 'carbohydrate')?.consistencyPct ??
      null,
    fat: macros.find((macro) => macro.key === 'fat')?.consistencyPct ?? null,
  });
  const cards = buildNutrientCards({
    rows: completeRows,
    targets,
    totalCalories,
    safeLoggedDays,
  });
  const summaryItems = cards.map((card) =>
    toSummaryItem(card, targets[card.nutrient])
  );
  const summaryBuckets = bucketNutrients(summaryItems);
  const micronutrients = cards.filter((card) =>
    DEFAULT_NUTRIENT_SET.has(card.nutrient)
  );
  const moreNutrients = cards.filter(
    (card) =>
      !DEFAULT_NUTRIENT_SET.has(card.nutrient) &&
      targets[card.nutrient].applicability !== 'hidden'
  );
  const { spotlight, steady } = partitionSpotlight(micronutrients);
  // Every logged day, NOT `completeRows`/`completeDates`: the chart is the one
  // part of the body that does not narrow with `dayScope`, so a bar's height
  // never moves when the toggle flips. See `buildDaySeries`.
  const daySeries = buildDaySeries({
    loggedRows,
    loggedDates,
    resolvedRange,
    period: { startDate: period.startDate, endDate: period.endDate },
    profile,
    targets,
  });

  return {
    requestedRange,
    resolvedRange,
    bucketTimezone: period.bucketTimezone,
    loggedDays,
    completeDays,
    partialDays,
    loggedDaysLast30,
    trendStatus: getTrendStatus(resolvedRange, completeDays),
    period: {
      startDate: period.startDate,
      endDate: period.endDate,
    },
    summary: {
      ...summaryBuckets,
      macroConsistency,
    },
    calorieAverages,
    macros,
    daySeries,
    micronutrients,
    spotlight,
    steady,
    moreNutrients,
    educationCards: [
      {
        id: 'vitamin_d',
        titleKey: 'nutrition.education.vitaminD.title',
        bodyKey: 'nutrition.education.vitaminD.body',
      },
    ],
  };
}
