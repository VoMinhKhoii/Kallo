export type BiologicalSex = 'male' | 'female';
export type ActivityLevel =
  | 'sedentary'
  | 'light'
  | 'moderate'
  | 'very_active';
export type Goal = 'cutting' | 'bulking' | 'maintaining';
export type Aggression = 'gentle' | 'moderate' | 'aggressive';
export type CarbSplit =
  | 'moderate_carb'
  | 'lower_carb'
  | 'higher_carb';
export type RegionalProfile =
  | 'mien_bac'
  | 'mien_trung'
  | 'mien_nam'
  | 'mien_tay';
export type OilUsage = 'minimal' | 'normal' | 'heavy';
export type FatTrim = 'trim' | 'eat_all' | 'by_dish';
export type RicePortion = 'small' | 'medium' | 'large';
export type SugarBraised = 'low' | 'medium' | 'high';

export interface BodyMetrics {
  biologicalSex: BiologicalSex;
  weightKg: number;
  heightCm: number;
  age: number;
  activityLevel: ActivityLevel;
}

export interface MacroTargets {
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
}

export interface CookingHabits {
  oilUsage: OilUsage;
  fatTrim: FatTrim; // Single value in onboarding, maps to all 3 schema columns
  boneAwareness: boolean;
  defaultRicePortion: RicePortion;
  sugarBraised: SugarBraised;
}

export interface OnboardingProfile {
  // Screen 1
  bodyMetrics: BodyMetrics;
  tdeeKcal: number;
  goal: Goal;
  aggression: Aggression | null; // null for maintaining
  carbSplit: CarbSplit;
  deficitOverride: number | null; // TRANSIENT: used to compute targets, not persisted to DB
  dailyTargets: MacroTargets;
  // Screen 2
  regionalProfile: RegionalProfile;
  // Screen 3
  cookingHabits: CookingHabits;
  // Screen 4
  handSpanCm: number | null;
  knuckleDepthCm: number | null;
  bowlSizeMl: number;
  plateSizeMl: number;
}
