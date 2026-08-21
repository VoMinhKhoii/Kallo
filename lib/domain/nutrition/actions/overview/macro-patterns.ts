import { getMacroConsistency } from '../../pattern/summary';
import type { MacroGoal, MacroKey, MacroPattern } from '../../types';
import type { OverviewMealItemRow } from './query';
import {
  groupDailyValues,
  type NumericRowKey,
  type NutritionProfile,
  nullableNumber,
  sumRows,
} from './row-metrics';

export function buildMacroPatterns(
  rows: OverviewMealItemRow[],
  safeLoggedDays: number,
  profile: NutritionProfile
): MacroPattern[] {
  const macroInputs: {
    key: MacroKey;
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
  ];

  return macroInputs.map((input) => ({
    key: input.key,
    labelKey: input.labelKey,
    averagePerDay: sumRows(rows, input.rowKey) / safeLoggedDays,
    target: input.target,
    unit: input.unit,
    consistencyPct: getMacroConsistency({
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
