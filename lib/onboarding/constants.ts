import type {
  ActivityLevel,
  Aggression,
  CarbSplit,
  CookingHabits,
  Goal,
  RegionalProfile,
} from './types';

// onboarding_step thresholds:
// 0 = not started
// 1 = Screen 1 complete (body metrics + goals)
// 2 = Screen 2 complete (regional profile)
// 3 = Screen 3 complete (cooking habits) — REQUIRED COMPLETE
// 4 = Screen 4 complete (portion calibration) — optional
export const ONBOARDING_REQUIRED_STEP = 3;

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

// kcal deficit/surplus per day (derived from 1 kg fat ≈ 7,700 kcal)
export const AGGRESSION_PRESETS: Record<Aggression, number> = {
  gentle: 275, // ~0.25 kg/week
  moderate: 550, // ~0.5 kg/week
  aggressive: 825, // ~0.75 kg/week
};

// Default cooking habits per regional profile — Screen 3 pre-fills from this
export const REGIONAL_COOKING_DEFAULTS: Record<
  RegionalProfile,
  CookingHabits
> = {
  mien_bac: {
    oilUsage: 'minimal',
    fatTrim: 'trim',
    boneAwareness: true,
    defaultRicePortion: 'medium',
    sugarBraised: 'low',
  },
  mien_trung: {
    oilUsage: 'normal',
    fatTrim: 'by_dish',
    boneAwareness: true,
    defaultRicePortion: 'medium',
    sugarBraised: 'medium',
  },
  mien_nam: {
    oilUsage: 'normal',
    fatTrim: 'eat_all',
    boneAwareness: false,
    defaultRicePortion: 'medium',
    sugarBraised: 'medium',
  },
  mien_tay: {
    oilUsage: 'heavy',
    fatTrim: 'eat_all',
    boneAwareness: false,
    defaultRicePortion: 'large',
    sugarBraised: 'high',
  },
};

// Form field defaults — what react-hook-form initializes inputs to
// Single source of truth for initial form state. Do NOT hardcode defaults in UI components.
// Screen 4 inputs start empty (null) — user must actively enter measurements
export const WIZARD_DEFAULTS = {
  // Screen 1 — body metrics: no defaults for weight/height/age/sex (blank, required fields)
  activityLevel: 'light' as ActivityLevel,
  // Screen 1 — goals
  goal: 'maintaining' as Goal,
  aggression: 'moderate' as Aggression, // auto-applied when goal switches to cutting/bulking
  carbSplit: 'moderate_carb' as CarbSplit,
  deficitOverride: null as number | null, // transient, initialized null
  // Screen 2 — regional: no default (must be explicitly chosen)
  // Screen 4 — starts empty, user must enter or skip
  handSpanCm: null as number | null,
  knuckleDepthCm: null as number | null,
  bowlSizeMl: 200,
  plateSizeMl: 400,
};

// DB fallback values written when user skips Screen 4 entirely
// Server Action uses these when onboardingStep < 4 (Screen 4 never submitted)
export const SKIP_FALLBACK_DEFAULTS = {
  handSpanCm: 20.0, // median adult hand span in cm
  knuckleDepthCm: 2.5, // median adult index finger knuckle depth in cm
  bowlSizeMl: 200,
  plateSizeMl: 400,
};
