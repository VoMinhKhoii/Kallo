import { DEFAULT_NUTRIENTS } from '../../catalog/nutrients';
import { resolveMicronutrientTargets } from '../../catalog/reference-targets';
import { getTrendStatus } from '../../pattern/summary';
import type {
  CalorieAverages,
  NutritionNutrientKey,
  NutritionOverview,
  NutritionRangeInput,
} from '../../types';
import { buildMacroPatterns } from './macro-patterns';
import { buildNutrientCards } from './nutrient-cards';
import type { NutritionProfile } from './row-metrics';

const DEFAULT_NUTRIENT_SET = new Set<NutritionNutrientKey>(DEFAULT_NUTRIENTS);

/**
 * Every nutrient row at zero: real targets, a null average that renders as "—".
 *
 * The page keeps its shape and reads the same on day one as on day thirty,
 * instead of swapping in a separate screen that hides the layout from exactly
 * the people who have not learned it yet.
 */
function buildZeroedCards(profile: NutritionProfile) {
  const targets = resolveMicronutrientTargets(profile);
  const cards = buildNutrientCards({
    rows: [],
    targets,
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
    micronutrients: cards.filter((card) =>
      DEFAULT_NUTRIENT_SET.has(card.nutrient)
    ),
    moreNutrients: cards.filter(
      (card) =>
        !DEFAULT_NUTRIENT_SET.has(card.nutrient) &&
        targets[card.nutrient].applicability !== 'hidden'
    ),
  };
}

/** What the two no-data paths actually differ by. Everything else is fixed. */
export interface EmptyOverviewInput {
  profile: NutritionProfile;
  requestedRange: NutritionRangeInput;
  resolvedRange: NutritionOverview['resolvedRange'];
  loggedDaysLast30: number;
  period: {
    startDate: string;
    endDate: string;
    bucketTimezone: 'local' | 'utc';
  };
  previousCalorieAverages: CalorieAverages;
  loggedDays: number;
  completeDays: number;
  partialDays: number;
  calorieAverages: CalorieAverages;
  daySeries: NutritionOverview['daySeries'];
}

/**
 * The page at zero: real targets, null averages that render as "—", and no
 * summary, since there is nothing to draw a conclusion from.
 *
 * One builder for both no-data paths — nothing logged at all, and a day scope
 * with no qualifying day. Written out twice they drifted immediately: one of
 * the two gained `previousCalorieAverages` and the other did not.
 */
export function buildEmptyOverview({
  profile,
  requestedRange,
  resolvedRange,
  loggedDaysLast30,
  period,
  previousCalorieAverages,
  loggedDays,
  completeDays,
  partialDays,
  calorieAverages,
  daySeries,
}: EmptyOverviewInput): NutritionOverview {
  const zeroed = buildZeroedCards(profile);

  return {
    requestedRange,
    resolvedRange,
    bucketTimezone: period.bucketTimezone,
    loggedDays,
    completeDays,
    partialDays,
    loggedDaysLast30,
    trendStatus: getTrendStatus(resolvedRange, completeDays),
    period: { startDate: period.startDate, endDate: period.endDate },
    summary: {
      mostConsistent: [],
      needsAttention: [],
      limitedDataCount: 0,
      macroConsistency: { averageConsistencyPct: 0, weakestMacro: null },
    },
    calorieAverages,
    previousCalorieAverages,
    macros: buildMacroPatterns([], 1, profile),
    daySeries,
    micronutrients: zeroed.micronutrients,
    spotlight: [],
    steady: [],
    moreNutrients: zeroed.moreNutrients,
    educationCards: [
      {
        id: 'vitamin_d',
        titleKey: 'nutrition.education.vitaminD.title',
        bodyKey: 'nutrition.education.vitaminD.body',
      },
    ],
  };
}
