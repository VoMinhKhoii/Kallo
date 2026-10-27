import {
  ACTIVITY_MULTIPLIERS,
  AGGRESSION_KCAL_PER_KG,
  CALORIE_FLOOR_KCAL,
  CARB_SPLIT_RATIOS,
  MIN_CALORIE_TARGET_KCAL,
} from './constants';
import { biologicalSexSchema, carbSplitSchema } from './schemas';
import type {
  ActivityLevel,
  BiologicalSex,
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
 * Lowest target a cut may reach: 1,200 kcal for women, 1,500 for men, or the
 * TDEE itself when maintenance is already below that, so a cut holds at
 * maintenance instead of turning into a surplus. Never under 500.
 */
export function calcCalorieFloor(sex: BiologicalSex, tdee: number): number {
  return Math.max(
    Math.min(tdee, CALORIE_FLOOR_KCAL[sex]),
    MIN_CALORIE_TARGET_KCAL
  );
}

/**
 * Compute daily calorie/macro targets based on goal and aggression.
 * aggression is kg/week (0.1–0.8). deficitOverride overrides when provided.
 * Calories never go below calcCalorieFloor.
 */
export function calcDailyTargets(
  tdee: number,
  goal: Goal,
  aggression: number | null,
  carbSplit: CarbSplit,
  biologicalSex: BiologicalSex,
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

  return calcMacroGrams(
    Math.max(calories, calcCalorieFloor(biologicalSex, tdee)),
    carbSplit
  );
}

/**
 * Server backstop for a target the client computed: an older app build (which
 * floored at 500 kcal) or a hand-made request can send one under the floor.
 * Returns the target to store and, when it had to be raised, macro grams
 * re-derived for it so they still add up to the stored number.
 */
export function floorSubmittedTarget(input: {
  calorieTarget?: unknown;
  tdeeKcal?: unknown;
  biologicalSex?: unknown;
  carbSplit?: unknown;
}): { calorieTarget: number; macros: MacroTargets | null } {
  const target = Number(input.calorieTarget) || 0;
  const sex = biologicalSexSchema.safeParse(input.biologicalSex);
  const tdee = Number(input.tdeeKcal);
  const floor =
    sex.success && tdee > 0
      ? calcCalorieFloor(sex.data, tdee)
      : MIN_CALORIE_TARGET_KCAL;
  if (target >= floor) return { calorieTarget: target, macros: null };
  const split = carbSplitSchema.safeParse(input.carbSplit);
  return {
    calorieTarget: floor,
    macros: split.success ? calcMacroGrams(floor, split.data) : null,
  };
}
