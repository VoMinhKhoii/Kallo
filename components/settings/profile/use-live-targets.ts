'use client';

import { useMemo } from 'react';
import { useWatch } from 'react-hook-form';
import {
  calcBMR,
  calcDailyTargets,
  calcMacroGrams,
  calcTDEE,
} from '@/lib/onboarding/tdee';
import type { ActivityLevel } from '@/lib/onboarding/types';

export interface LiveTargets {
  goal: string;
  aggression: number | null;
  carbSplit: string;
  /** True once sex/weight/height/age/activity are all present. */
  allMetricsFilled: boolean;
  /** Maintenance TDEE, or null until metrics are complete. */
  tdee: number | null;
  /** Raw (un-floored) daily target calories; 0 until tdee exists. */
  targetCalories: number;
  /** Macro grams at the live target/split, or null until tdee exists. */
  macros: ReturnType<typeof calcMacroGrams> | null;
  /** The floored (min 500) target the save button names, or null. */
  pendingTarget: number | null;
}

/**
 * Mirrors the persisted-target computation off the live form so the save bar
 * can name its consequence and the metrics/target UI can preview the recompute.
 * Called once in SettingsForm; results are passed down as props.
 */
export function useLiveTargets(): LiveTargets {
  const biologicalSex = useWatch({ name: 'biologicalSex' });
  const weightKg = useWatch({ name: 'weightKg' });
  const heightCm = useWatch({ name: 'heightCm' });
  const age = useWatch({ name: 'age' });
  const activityLevel = useWatch({ name: 'activityLevel' });
  const goal = useWatch({ name: 'goal' });
  const aggression = useWatch({ name: 'aggression' });
  const carbSplit = useWatch({ name: 'carbSplit' });

  const allMetricsFilled = !!(
    biologicalSex &&
    weightKg &&
    heightCm &&
    age &&
    activityLevel
  );

  const tdee = useMemo(() => {
    if (!allMetricsFilled) return null;
    const bmr = calcBMR({
      biologicalSex,
      weightKg,
      heightCm,
      age,
      activityLevel: activityLevel as ActivityLevel,
    });
    return calcTDEE(bmr, activityLevel as ActivityLevel);
  }, [biologicalSex, weightKg, heightCm, age, activityLevel, allMetricsFilled]);

  const finalTargets = useMemo(() => {
    if (tdee === null) return null;
    return calcDailyTargets(tdee, goal, aggression, carbSplit);
  }, [tdee, goal, aggression, carbSplit]);

  const targetCalories = finalTargets?.calories ?? 0;

  const macros = useMemo(() => {
    if (!targetCalories) return null;
    return calcMacroGrams(targetCalories, carbSplit);
  }, [targetCalories, carbSplit]);

  const pendingTarget =
    tdee === null ? null : Math.round(Math.max(targetCalories, 500));

  return {
    goal,
    aggression,
    carbSplit,
    allMetricsFilled,
    tdee,
    targetCalories,
    macros,
    pendingTarget,
  };
}
