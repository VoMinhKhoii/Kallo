import type { z } from 'zod';
import { bodyMetricsSchema, goalSchema } from '@/lib/onboarding/schemas';
import type { ActivityLevel, CarbSplit, Goal } from '@/lib/onboarding/types';

// Merged schema for screen 1
export const screen1Schema = bodyMetricsSchema.merge(goalSchema);
export type Screen1FormData = z.infer<typeof screen1Schema>;

export const ACTIVITY_LEVELS: ActivityLevel[] = [
  'sedentary',
  'light',
  'moderate',
  'very_active',
];

export const ACTIVITY_LEVEL_KEYS: Record<ActivityLevel, string> = {
  sedentary: 'bodyMetrics.sedentary',
  light: 'bodyMetrics.light',
  moderate: 'bodyMetrics.moderate',
  very_active: 'bodyMetrics.veryActive',
};

export const GOALS: Goal[] = ['cutting', 'maintaining', 'bulking'];
export const CARB_SPLITS: CarbSplit[] = [
  'moderate_carb',
  'lower_carb',
  'higher_carb',
];

export const CARB_SPLIT_KEYS: Record<CarbSplit, string> = {
  moderate_carb: 'bodyMetrics.moderateCarb',
  lower_carb: 'bodyMetrics.lowerCarb',
  higher_carb: 'bodyMetrics.higherCarb',
};

export const CARB_SPLIT_DESCS: Record<CarbSplit, string> = {
  moderate_carb: 'bodyMetrics.moderateCarbDescription',
  lower_carb: 'bodyMetrics.lowerCarbDescription',
  higher_carb: 'bodyMetrics.higherCarbDescription',
};

export const GOAL_KEYS: Record<Goal, string> = {
  maintaining: 'bodyMetrics.maintaining',
  cutting: 'bodyMetrics.cutting',
  bulking: 'bodyMetrics.bulking',
};

// Custom dropdown matching the Apple Notes aesthetic. Menu is portal-rendered
// with viewport-fixed positioning so it overflows the wizard's overflow-hidden
// modal instead of being clipped at the bottom edge.

import type { calcMacroGrams } from '@/lib/onboarding/tdee';

export interface CarbOption {
  id: CarbSplit;
  label: string;
  desc: string;
  macros: ReturnType<typeof calcMacroGrams>;
}
