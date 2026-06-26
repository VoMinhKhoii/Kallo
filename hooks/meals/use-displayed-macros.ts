'use client';

import { useMemo } from 'react';
import { goalAdjustNutrition } from '@/lib/ai/pipeline/goal-adjustment';
import type { BoundedNutrition, NutritionValues } from '@/lib/ai/types';
import type { Goal } from '@/lib/onboarding/types';

export interface GoalProfile {
  goal: Goal;
  aggression: number;
}

/**
 * Derive a single displayed NutritionValues from bounded nutrition + user goal.
 * Memoized on the bounded ref, goal, and aggression.
 */
export function useDisplayedMacros(
  bounded: BoundedNutrition | null,
  profile: GoalProfile
): NutritionValues | null {
  return useMemo(() => {
    if (!bounded) return null;
    return goalAdjustNutrition(bounded, profile.goal, profile.aggression);
  }, [bounded, profile.goal, profile.aggression]);
}
