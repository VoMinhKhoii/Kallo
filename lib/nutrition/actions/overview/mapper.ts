import type { userProfiles } from '@/lib/db/schema';
import {
  DEFAULT_NUTRIENTS,
  MORE_NUTRIENTS,
  SUPPORTED_CANDIDATE_NUTRIENT_SET,
  type SupportedCandidateNutrient,
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
  MacroGoal,
  MacroKey,
  MacroPattern,
  NutrientCardData,
  NutrientSummaryItem,
  NutritionNutrientKey,
  NutritionOverview,
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

function isSpotlightCandidate(card: NutrientCardData): boolean {
  return (
    card.supportsCandidates &&
    card.confidence >= SPOTLIGHT_MIN_CONFIDENCE &&
    card.percentOfTarget !== null &&
    card.percentOfTarget < SPOTLIGHT_MAX_PERCENT &&
    SUPPORTED_CANDIDATE_NUTRIENT_SET.has(
      card.nutrient as SupportedCandidateNutrient
    )
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
      supportsCandidates: DEFAULT_NUTRIENT_SET.has(nutrient),
      nutrientType: target.nutrientType,
    });
  });
}

export function mapOverviewRowsToDto({
  rows,
  profile,
  requestedRange,
  resolvedRange,
  loggedDaysLast30,
  period,
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
      macros: [],
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
  const { completeDates, completeDays, partialDays } = classifyDayCompleteness(
    [...dayCalories].map(([date, calories]) => ({ date, calories })),
    nullableNumber(profile.calorieTarget)
  );
  const completeRows = rows.filter((row) => completeDates.has(row.localDate));

  // safeLoggedDays divides nutrient sums to produce "average per complete day".
  // Both numerator (sumRows over completeRows) and denominator (completeDays)
  // are scoped to the same set of complete days, so half-logged days neither
  // inflate the divisor nor leak their partial sums into the average.
  const safeLoggedDays = completeDays;
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
    macros,
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
