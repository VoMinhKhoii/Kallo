import type { PersistedMeal } from '@/lib/actions/meals';
import type { MealEntry, NutritionData } from '@/lib/types/dashboard';

export interface DashboardTodayTargets {
  calorieTarget: number;
  proteinTargetG: number;
  carbsTargetG: number;
  fatTargetG: number;
}

function roundNutritionValue(value: number | null): number {
  return Math.round(value ?? 0);
}

export function getTodayDateString(now: Date = new Date()): string {
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');

  return `${yyyy}-${mm}-${dd}`;
}

export function mapPersistedMealsToMealEntries(
  meals: PersistedMeal[]
): MealEntry[] {
  return meals.map((meal) => ({
    id: meal.id,
    label: meal.rawInput,
    calories: roundNutritionValue(meal.nutrition.caloriesKcal),
  }));
}

export function buildTodayNutritionData(
  meals: PersistedMeal[],
  targets: DashboardTodayTargets
): NutritionData {
  const totals = meals.reduce(
    (sum, meal) => ({
      calories: sum.calories + (meal.nutrition.caloriesKcal ?? 0),
      protein: sum.protein + (meal.nutrition.proteinG ?? 0),
      carbs: sum.carbs + (meal.nutrition.carbohydrateG ?? 0),
      fat: sum.fat + (meal.nutrition.fatG ?? 0),
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  );

  return {
    calories: {
      current: Math.round(totals.calories),
      target: targets.calorieTarget,
    },
    protein: {
      current: Math.round(totals.protein),
      target: targets.proteinTargetG,
    },
    carbs: {
      current: Math.round(totals.carbs),
      target: targets.carbsTargetG,
    },
    fat: {
      current: Math.round(totals.fat),
      target: targets.fatTargetG,
    },
  };
}
