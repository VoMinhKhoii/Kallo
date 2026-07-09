import type { userProfiles } from '@/lib/db/schema';
import {
  DEFAULT_NUTRIENTS,
  getNutrientMeta,
  MORE_NUTRIENTS,
} from '../../catalog/nutrients';
import {
  type MicronutrientTarget,
  resolveMicronutrientTargets,
} from '../../catalog/reference-targets';
import {
  buildNutrientCard,
  getNutrientStatus,
  getSodiumCaveatKey,
} from '../../pattern/aggregation';
import { classifyDayCompleteness } from '../../pattern/completeness';
import {
  getCaloriesWithNutrientData,
  getNutrientConfidence,
} from '../../pattern/confidence';
import type { getNutritionPeriod } from '../../pattern/date-range';
import {
  bucketNutrients,
  getMacroConsistency,
  getMacroConsistencySummary,
  getTrendStatus,
} from '../../pattern/summary';
import type {
  CalorieAverages,
  DaySeriesBucket,
  DaySeriesBucketUnit,
  DaySeriesMetricKey,
  MacroGoal,
  MacroKey,
  MacroPattern,
  NutrientCardData,
  NutrientDaySeries,
  NutrientSummaryItem,
  NutritionDayScope,
  NutritionDaySeries,
  NutritionNutrientKey,
  NutritionOverview,
  NutritionRange,
  NutritionRangeInput,
} from '../../types';
import type { OverviewMealItemRow } from './query';

const DEFAULT_NUTRIENT_SET = new Set<NutritionNutrientKey>(DEFAULT_NUTRIENTS);
const ALL_CARD_NUTRIENTS = [...DEFAULT_NUTRIENTS, ...MORE_NUTRIENTS];
const FAO_VIETNAM_SOURCE_CODE = 'FAO_VN_2007';
const CONDIMENT_TYPE_EN = 'Condiments, traditional sauces';
const CONDIMENT_TYPE_VN = 'Gia vị, nước chấm';
const SPOTLIGHT_LIMIT = 2;
const SPOTLIGHT_MIN_CONFIDENCE = 40;
const SPOTLIGHT_MAX_PERCENT = 90;

// Day-series bucket granularity per resolved range: short ranges bucket by day,
// long ranges by week. Table-driven so a new range needs no conditional edits.
const RANGE_BUCKET_UNIT: Record<NutritionRange, DaySeriesBucketUnit> = {
  '1d': 'day',
  '7d': 'day',
  '30d': 'week',
  '90d': 'week',
};

function isSpotlightCandidate(card: NutrientCardData): boolean {
  // Every default micronutrient can surface food candidates (the composition
  // table has a column for each), so the gate is purely confidence + gap.
  // `partitionSpotlight` is only ever called on the default micronutrients.
  return (
    card.confidence >= SPOTLIGHT_MIN_CONFIDENCE &&
    card.percentOfTarget !== null &&
    card.percentOfTarget < SPOTLIGHT_MAX_PERCENT
  );
}

function partitionSpotlight(cards: NutrientCardData[]): {
  spotlight: NutrientCardData[];
  steady: NutrientCardData[];
} {
  const spotlight = cards
    .filter(isSpotlightCandidate)
    .sort((a, b) => (a.percentOfTarget ?? 999) - (b.percentOfTarget ?? 999))
    .slice(0, SPOTLIGHT_LIMIT);
  const spotlightSet = new Set(spotlight.map((card) => card.nutrient));
  const steady = cards.filter((card) => !spotlightSet.has(card.nutrient));
  return { spotlight, steady };
}

type NutritionProfile = typeof userProfiles.$inferSelect;
type NutritionPeriod = ReturnType<typeof getNutritionPeriod>;
type NumericRowKey = {
  [K in keyof OverviewMealItemRow]: OverviewMealItemRow[K] extends number | null
    ? K
    : never;
}[keyof OverviewMealItemRow];

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

function sumRows(rows: OverviewMealItemRow[], key: NumericRowKey): number {
  return rows.reduce((sum, row) => sum + Math.max(0, row[key] ?? 0), 0);
}

function groupDailyValues(
  rows: OverviewMealItemRow[],
  key: NumericRowKey
): number[] {
  const dailyValues = new Map<string, number>();

  for (const row of rows) {
    if (row.calories <= 0) {
      continue;
    }

    dailyValues.set(
      row.localDate,
      (dailyValues.get(row.localDate) ?? 0) + (row[key] ?? 0)
    );
  }

  return [...dailyValues.values()];
}

function nullableNumber(value: number | string | null): number | null {
  if (value === null) {
    return null;
  }

  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : null;
}

function buildMacroPatterns(
  rows: OverviewMealItemRow[],
  safeLoggedDays: number,
  profile: NutritionProfile
): MacroPattern[] {
  const macroInputs: {
    key: MacroKey | 'fiber';
    rowKey: NumericRowKey;
    labelKey: string;
    target: number | null;
    unit: string;
  }[] = [
    {
      key: 'calories',
      rowKey: 'calories',
      labelKey: 'nutrition.macros.calories',
      target: nullableNumber(profile.calorieTarget),
      unit: 'kcal',
    },
    {
      key: 'protein',
      rowKey: 'proteinG',
      labelKey: 'nutrition.macros.protein',
      target: nullableNumber(profile.proteinTargetG),
      unit: 'g',
    },
    {
      key: 'carbohydrate',
      rowKey: 'carbohydrateG',
      labelKey: 'nutrition.macros.carbohydrate',
      target: nullableNumber(profile.carbsTargetG),
      unit: 'g',
    },
    {
      key: 'fat',
      rowKey: 'fatG',
      labelKey: 'nutrition.macros.fat',
      target: nullableNumber(profile.fatTargetG),
      unit: 'g',
    },
    {
      key: 'fiber',
      rowKey: 'fiberG',
      labelKey: 'nutrition.macros.fiber',
      target: null,
      unit: 'g',
    },
  ];

  return macroInputs.map((input) => ({
    key: input.key,
    labelKey: input.labelKey,
    averagePerDay: sumRows(rows, input.rowKey) / safeLoggedDays,
    target: input.target,
    unit: input.unit,
    consistencyPct:
      input.key === 'fiber'
        ? null
        : getMacroConsistency({
            macro: input.key,
            target: input.target,
            values: groupDailyValues(rows, input.rowKey),
            goal: resolveMacroGoal(profile.goal),
          }),
    nutrientType: input.key === 'calories' ? 'range' : 'floor',
  }));
}

function resolveMacroGoal(rawGoal: string | null): MacroGoal {
  if (rawGoal === 'cutting' || rawGoal === 'bulking') return rawGoal;
  return 'maintaining';
}

function getSodiumSourceStats(
  rows: OverviewMealItemRow[],
  totalCalories: number
): {
  confidence: number;
  faoVietnamCalorieShare: number;
  faoVietnamConfidence: number | null;
  missingSodiumCondimentItems: number;
} {
  const faoRows = rows.filter(
    (row) => row.sourceCode === FAO_VIETNAM_SOURCE_CODE
  );
  const faoCalories = faoRows.reduce(
    (sum, row) => sum + Math.max(0, row.calories),
    0
  );
  const faoCaloriesWithSodium = getCaloriesWithNutrientData(
    faoRows.map((row) => ({
      calories: row.calories,
      nutrientValue: row.sodiumMg,
    }))
  );
  const confidence = getNutrientConfidence({
    totalCalories,
    caloriesWithNutrientData: getCaloriesWithNutrientData(
      rows.map((row) => ({
        calories: row.calories,
        nutrientValue: row.sodiumMg,
      }))
    ),
  });

  return {
    confidence,
    faoVietnamCalorieShare: totalCalories > 0 ? faoCalories / totalCalories : 0,
    faoVietnamConfidence:
      faoCalories > 0
        ? getNutrientConfidence({
            totalCalories: faoCalories,
            caloriesWithNutrientData: faoCaloriesWithSodium,
          })
        : null,
    missingSodiumCondimentItems: faoRows.filter(
      (row) =>
        row.sodiumMg === null &&
        (row.typeEn === CONDIMENT_TYPE_EN || row.typeVn === CONDIMENT_TYPE_VN)
    ).length,
  };
}

function toSummaryItem(
  card: NutrientCardData,
  target: MicronutrientTarget
): NutrientSummaryItem {
  return {
    nutrient: card.nutrient,
    labelKey: card.labelKey,
    average: card.averagePerDay ?? 0,
    unit: card.unit,
    percentOfTarget: card.percentOfTarget,
    confidence: card.confidence,
    status: getNutrientStatus(
      card.percentOfTarget,
      card.confidence,
      target.nutrientType
    ),
    applicability: target.applicability,
    nutrientType: target.nutrientType,
  };
}

function buildNutrientCards({
  rows,
  targets,
  totalCalories,
  safeLoggedDays,
}: {
  rows: OverviewMealItemRow[];
  targets: Record<NutritionNutrientKey, MicronutrientTarget>;
  totalCalories: number;
  safeLoggedDays: number;
}): NutrientCardData[] {
  const sodiumStats = getSodiumSourceStats(rows, totalCalories);

  return ALL_CARD_NUTRIENTS.map((nutrient) => {
    const target = targets[nutrient];
    const nutrientRows = rows.map((row) => ({
      calories: row.calories,
      nutrientValue: row[nutrient],
    }));
    const confidence = getNutrientConfidence({
      totalCalories,
      caloriesWithNutrientData: getCaloriesWithNutrientData(nutrientRows),
    });
    const averagePerDay = sumRows(rows, nutrient) / safeLoggedDays;
    const betaCaroteneAveragePerDay =
      nutrient === 'vitaminAMcg'
        ? sumRows(rows, 'betaCaroteneMcg') / safeLoggedDays
        : undefined;
    const sourceBreakdown =
      nutrient === 'sodiumMg'
        ? {
            faoVietnamCalorieShare: sodiumStats.faoVietnamCalorieShare,
            faoVietnamConfidence: sodiumStats.faoVietnamConfidence,
            missingSodiumCondimentItems:
              sodiumStats.missingSodiumCondimentItems,
          }
        : undefined;

    return buildNutrientCard({
      nutrient,
      averagePerDay,
      target: target.value,
      targetSource: target.source,
      confidence,
      betaCaroteneAveragePerDay,
      caveatKey:
        nutrient === 'sodiumMg' ? getSodiumCaveatKey(sodiumStats) : undefined,
      sourceBreakdown,
      nutrientType: target.nutrientType,
    });
  });
}

// Metrics charted on the per-day time axis: the four targeted macros followed
// by the default micronutrients. Each entry knows the row column it sums and
// the macro target (micros resolve their target from `targets` at build time).
const DAY_SERIES_MACROS: {
  metric: DaySeriesMetricKey;
  rowKey: NumericRowKey;
  labelKey: string;
  unit: string;
  target: (profile: NutritionProfile) => number | null;
}[] = [
  {
    metric: 'calories',
    rowKey: 'calories',
    labelKey: 'nutrition.macros.calories',
    unit: 'kcal',
    target: (p) => nullableNumber(p.calorieTarget),
  },
  {
    metric: 'protein',
    rowKey: 'proteinG',
    labelKey: 'nutrition.macros.protein',
    unit: 'g',
    target: (p) => nullableNumber(p.proteinTargetG),
  },
  {
    metric: 'carbohydrate',
    rowKey: 'carbohydrateG',
    labelKey: 'nutrition.macros.carbohydrate',
    unit: 'g',
    target: (p) => nullableNumber(p.carbsTargetG),
  },
  {
    metric: 'fat',
    rowKey: 'fatG',
    labelKey: 'nutrition.macros.fat',
    unit: 'g',
    target: (p) => nullableNumber(p.fatTargetG),
  },
];

function addDays(date: string, days: number): string {
  const parsed = Date.parse(`${date}T00:00:00.000Z`);
  return new Date(parsed + days * 86_400_000).toISOString().slice(0, 10);
}

function diffDays(start: string, end: string): number {
  const a = Date.parse(`${start}T00:00:00.000Z`);
  const b = Date.parse(`${end}T00:00:00.000Z`);
  return Math.round((b - a) / 86_400_000);
}

/**
 * Walk the period start→end in `step`-day windows. Day buckets use step 1;
 * week buckets use step 7. The final bucket clamps to the period end so a
 * 90-day window doesn't emit a partial trailing week past `endDate`.
 */
function buildBucketBounds(
  startDate: string,
  endDate: string,
  step: number
): { startDate: string; endDate: string }[] {
  const bounds: { startDate: string; endDate: string }[] = [];
  const totalDays = diffDays(startDate, endDate);
  for (let offset = 0; offset <= totalDays; offset += step) {
    const bucketStart = addDays(startDate, offset);
    const bucketEnd = addDays(
      startDate,
      Math.min(offset + step - 1, totalDays)
    );
    bounds.push({ startDate: bucketStart, endDate: bucketEnd });
  }
  return bounds;
}

interface DaySeriesMetricSpec {
  metric: DaySeriesMetricKey;
  rowKey: NumericRowKey;
  labelKey: string;
  unit: string;
  target: number | null;
}

/** Build one metric's bucket series: each bucket's value is the per-day average
 *  of the metric over that bucket's COMPLETE days only. Pure over its inputs so
 *  the day-series builder stays a flat map over the metric specs. */
function buildMetricSeries(
  spec: DaySeriesMetricSpec,
  bounds: { startDate: string; endDate: string }[],
  completeDaysInBucket: number[],
  completeRows: OverviewMealItemRow[]
): NutrientDaySeries {
  const buckets: DaySeriesBucket[] = bounds.map((bucket, index) => {
    const days = completeDaysInBucket[index];
    if (days === 0) {
      return {
        startDate: bucket.startDate,
        endDate: bucket.endDate,
        value: null,
        ratioOfTarget: null,
      };
    }
    const total = completeRows.reduce((sum, row) => {
      if (row.localDate < bucket.startDate || row.localDate > bucket.endDate) {
        return sum;
      }
      return sum + Math.max(0, row[spec.rowKey] ?? 0);
    }, 0);
    const value = total / days;
    return {
      startDate: bucket.startDate,
      endDate: bucket.endDate,
      value,
      ratioOfTarget:
        spec.target && spec.target > 0 ? value / spec.target : null,
    };
  });

  const values = buckets
    .map((bucket) => bucket.value)
    .filter((value): value is number => value !== null);

  return {
    metric: spec.metric,
    labelKey: spec.labelKey,
    unit: spec.unit,
    target: spec.target,
    buckets,
    min: values.length > 0 ? Math.min(...values) : null,
    max: values.length > 0 ? Math.max(...values) : null,
  };
}

/**
 * Build the per-bucket time series. Each bucket's value is the per-day average
 * of the metric over that bucket's COMPLETE days only — the same complete-day
 * scoping the headline averages use — so a day-strip reads on the same scale
 * as the rhythm figure above it.
 */
function buildDaySeries({
  completeRows,
  completeDates,
  resolvedRange,
  period,
  profile,
  targets,
}: {
  completeRows: OverviewMealItemRow[];
  completeDates: Set<string>;
  resolvedRange: NutritionOverview['resolvedRange'];
  period: { startDate: string; endDate: string };
  profile: NutritionProfile;
  targets: Record<NutritionNutrientKey, MicronutrientTarget>;
}): NutritionDaySeries {
  const unit: DaySeriesBucketUnit = RANGE_BUCKET_UNIT[resolvedRange];
  const step = unit === 'day' ? 1 : 7;
  const bounds = buildBucketBounds(period.startDate, period.endDate, step);

  // Count complete days per bucket once; reused for every metric's divisor.
  const completeDaysInBucket = bounds.map((bucket) => {
    let count = 0;
    for (const date of completeDates) {
      if (date >= bucket.startDate && date <= bucket.endDate) {
        count += 1;
      }
    }
    return count;
  });

  const metrics: DaySeriesMetricSpec[] = [
    ...DAY_SERIES_MACROS.map((macro) => ({
      metric: macro.metric,
      rowKey: macro.rowKey,
      labelKey: macro.labelKey,
      unit: macro.unit,
      target: macro.target(profile),
    })),
    ...DEFAULT_NUTRIENTS.map((nutrient) => {
      const meta = getNutrientMeta(nutrient);
      return {
        metric: nutrient as DaySeriesMetricKey,
        rowKey: nutrient as NumericRowKey,
        labelKey: meta.labelKey,
        unit: meta.unit,
        target: targets[nutrient].value,
      };
    }),
  ];

  const series: NutrientDaySeries[] = metrics.map((spec) =>
    buildMetricSeries(spec, bounds, completeDaysInBucket, completeRows)
  );

  return { unit, series };
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

  // Strict `'complete'` scope with no qualifying days: return a body-empty DTO
  // (the client shows a "no complete days yet" state) while still carrying the
  // real day counts and both calorie averages.
  if (averagingDayCount === 0) {
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

  const completeDates = averagingDates;
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
  const daySeries = buildDaySeries({
    completeRows,
    completeDates,
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
