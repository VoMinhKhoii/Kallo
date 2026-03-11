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
// 3 = Screen 3 complete (portion calibration)
// 4 = Screen 4 complete (cooking habits) — ALL REQUIRED
export const ONBOARDING_REQUIRED_STEP = 4;

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

// Default cooking habits per regional profile — Screen 3 pre-fills from this
export const REGIONAL_COOKING_DEFAULTS: Record<RegionalProfile, CookingHabits> =
  {
    mien_bac: {
      oilUsage: 'minimal',
      defaultRicePortion: 'medium',
      sugarBraised: 'low',
      defaultProteinPortion: 'medium',
      brothConsumption: 'some',
    },
    mien_trung: {
      oilUsage: 'normal',
      defaultRicePortion: 'medium',
      sugarBraised: 'medium',
      defaultProteinPortion: 'medium',
      brothConsumption: 'some',
    },
    mien_nam: {
      oilUsage: 'normal',
      defaultRicePortion: 'medium',
      sugarBraised: 'medium',
      defaultProteinPortion: 'medium',
      brothConsumption: 'finish_it',
    },
    mien_tay: {
      oilUsage: 'heavy',
      defaultRicePortion: 'large',
      sugarBraised: 'high',
      defaultProteinPortion: 'large',
      brothConsumption: 'finish_it',
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
  aggression: 0.5 as Aggression, // auto-applied when goal switches to cutting/bulking
  carbSplit: 'moderate_carb' as CarbSplit,
  deficitOverride: null as number | null, // transient, initialized null
  // Screen 3 — portion calibration: starts empty, user must enter or skip
  handSpanCm: null as number | null,
  knuckleDepthCm: null as number | null,
};

// DB fallback values written when user skips Screen 3 (Portion Calibration)
export const SKIP_FALLBACK_DEFAULTS = {
  handSpanCm: 20.0, // median adult hand span in cm
  knuckleDepthCm: 2.5, // median adult index finger knuckle depth in cm
};
