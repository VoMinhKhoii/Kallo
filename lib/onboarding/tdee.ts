import {
  ACTIVITY_MULTIPLIERS,
  AGGRESSION_KCAL_PER_KG,
  CARB_SPLIT_RATIOS,
} from './constants';
import type {
  ActivityLevel,
  BodyMetrics,
  CarbSplit,
  Goal,
  MacroTargets,
} from './types';

/**
 * Mifflin-St Jeor BMR formula.
 * Male:   (10 × kg) + (6.25 × cm) - (5 × age) + 5
 * Female: (10 × kg) + (6.25 × cm) - (5 × age) - 161
 * Returns raw BMR (no rounding — rounding happens in TDEE).
 */
export function calcBMR(metrics: BodyMetrics): number {
  const base =
    10 * metrics.weightKg + 6.25 * metrics.heightCm - 5 * metrics.age;
  return metrics.biologicalSex === 'male' ? base + 5 : base - 161;
}

/**
 * TDEE = BMR × activity multiplier, rounded.
 */
export function calcTDEE(bmr: number, activityLevel: ActivityLevel): number {
  return Math.round(bmr * ACTIVITY_MULTIPLIERS[activityLevel]);
}

/**
 * Compute macro grams from total calories and carb split ratio.
 * Protein: 4 cal/g, Carbs: 4 cal/g, Fat: 9 cal/g.
 */
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

/**
 * Compute daily calorie/macro targets based on goal and aggression.
 * aggression is kg/week (0.1–0.8). deficitOverride overrides when provided.
 */
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

  // NOTE: calories may go negative if deficitOverride > tdee.
  // Caller (Server Action) must clamp: Math.max(result.calories, 500) before persisting.
  return calcMacroGrams(calories, carbSplit);
}
