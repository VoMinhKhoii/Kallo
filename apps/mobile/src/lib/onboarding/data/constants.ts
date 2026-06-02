/**
 * Vendored verbatim from web `lib/onboarding/constants.ts` (keep in sync).
 * Pure consts; type-only import of the enum types from `@/lib`.
 */
import type {
  ActivityLevel,
  Aggression,
  CarbSplit,
  CookingHabits,
  Goal,
} from '@/lib/onboarding/types';

export const ONBOARDING_TOTAL_STEPS = 3;

export const ACTIVITY_MULTIPLIERS: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  very_active: 1.725,
};

// Ratios as protein% / fat% / carbs% (must sum to 100)
export const CARB_SPLIT_RATIOS: Record<
  CarbSplit,
  { protein: number; fat: number; carbs: number }
> = {
  moderate_carb: { protein: 30, fat: 35, carbs: 35 },
  lower_carb: { protein: 40, fat: 40, carbs: 20 },
  higher_carb: { protein: 30, fat: 20, carbs: 50 },
};

// 1 kg fat ≈ 7,700 kcal → daily kcal = kg/week × 1100
export const AGGRESSION_KCAL_PER_KG = 1100;

export const NEUTRAL_COOKING_DEFAULTS: CookingHabits = {
  oilUsage: 'normal',
  defaultRicePortion: 'medium',
  sugarBraised: 'medium',
  defaultProteinPortion: 'medium',
  brothConsumption: 'some',
};

export const WIZARD_DEFAULTS = {
  activityLevel: 'light' as ActivityLevel,
  goal: 'maintaining' as Goal,
  aggression: 0.5 as Aggression,
  carbSplit: 'moderate_carb' as CarbSplit,
  deficitOverride: null as number | null,
};
