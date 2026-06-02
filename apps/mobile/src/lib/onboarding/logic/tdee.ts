/**
 * Vendored verbatim from web `lib/onboarding/tdee.ts` (keep in sync). Pure
 * Mifflin–St Jeor calc; no rounding in BMR (rounding happens in TDEE/macros).
 */
import type {
  ActivityLevel,
  BodyMetrics,
  CarbSplit,
  Goal,
  MacroTargets,
} from '@/lib/onboarding/types';
import {
  ACTIVITY_MULTIPLIERS,
  AGGRESSION_KCAL_PER_KG,
  CARB_SPLIT_RATIOS,
} from '../data/constants';

export function calcBMR(metrics: BodyMetrics): number {
  const base =
    10 * metrics.weightKg + 6.25 * metrics.heightCm - 5 * metrics.age;
  return metrics.biologicalSex === 'male' ? base + 5 : base - 161;
}

export function calcTDEE(bmr: number, activityLevel: ActivityLevel): number {
  return Math.round(bmr * ACTIVITY_MULTIPLIERS[activityLevel]);
}

export function calcMacroGrams(
  calories: number,
  carbSplit: CarbSplit
): MacroTargets {
  const ratio = CARB_SPLIT_RATIOS[carbSplit];
  return {
    calories: Math.round(calories),
    proteinG: Math.round((calories * ratio.protein) / 100 / 4),
    carbsG: Math.round((calories * ratio.carbs) / 100 / 4),
    fatG: Math.round((calories * ratio.fat) / 100 / 9),
  };
}

export function calcDailyTargets(
  tdee: number,
  goal: Goal,
  aggression: number | null,
  carbSplit: CarbSplit,
  deficitOverride?: number | null
): MacroTargets {
  let calories: number;

  if (goal === 'maintaining') {
    calories = tdee;
  } else {
    const safeAggression = aggression ?? 0;
    const adjustment =
      deficitOverride ?? Math.round(safeAggression * AGGRESSION_KCAL_PER_KG);
    calories = goal === 'cutting' ? tdee - adjustment : tdee + adjustment;
  }

  // calories may go negative if deficitOverride > tdee; the server clamps
  // calorieTarget = Math.max(., 500) before persisting.
  return calcMacroGrams(calories, carbSplit);
}
