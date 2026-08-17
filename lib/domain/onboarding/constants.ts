import type {
  ActivityLevel,
  Aggression,
  CarbSplit,
  CookingHabits,
  Goal,
} from './types';

// onboarding_step thresholds:
// 0 = not started
// 1 = Screen 1 complete (origin + language)
// 2 = Screen 2 complete (body metrics + goals)
// 3 = Screen 3 complete (cooking habits) — ALL SCREENS DONE
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

// Neutral cooking habit defaults — used when no profile data is available
export const NEUTRAL_COOKING_DEFAULTS: CookingHabits = {
  oilUsage: 'normal',
  defaultRicePortion: 'medium',
  sugarBraised: 'medium',
  defaultProteinPortion: 'medium',
  brothConsumption: 'some',
};

// Form field defaults — what react-hook-form initializes inputs to
// Single source of truth for initial form state. Do NOT hardcode defaults in UI components.
export const WIZARD_DEFAULTS = {
  // Screen 1 — body metrics: no defaults for weight/height/age/sex (blank, required fields)
  activityLevel: 'light' as ActivityLevel,
  // Screen 1 — goals
  goal: 'maintaining' as Goal,
  aggression: 0.5 as Aggression, // auto-applied when goal switches to cutting/bulking
  carbSplit: 'moderate_carb' as CarbSplit,
  deficitOverride: null as number | null, // transient, initialized null
};
