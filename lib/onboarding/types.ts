import type { z } from 'zod';
import type {
  activityLevelSchema,
  biologicalSexSchema,
  bodyMetricsSchema,
  brothConsumptionSchema,
  carbSplitSchema,
  cookingHabitsSchema,
  goalEnumSchema,
  oilUsageSchema,
  proteinPortionSchema,
  regionalProfileSchema,
  ricePortionSchema,
  sugarBraisedSchema,
} from './schemas';

// ---------------------------------------------------------------------------
// Enum types derived from Zod schemas (single source of truth)
// ---------------------------------------------------------------------------

export type BiologicalSex = z.infer<typeof biologicalSexSchema>;
export type ActivityLevel = z.infer<typeof activityLevelSchema>;
export type Goal = z.infer<typeof goalEnumSchema>;
/** kg/week rate (0.1–0.8, step 0.1) */
export type Aggression = number;
export type CarbSplit = z.infer<typeof carbSplitSchema>;
export type RegionalProfile = z.infer<typeof regionalProfileSchema>;
export type OilUsage = z.infer<typeof oilUsageSchema>;
export type RicePortion = z.infer<typeof ricePortionSchema>;
export type SugarBraised = z.infer<typeof sugarBraisedSchema>;
export type ProteinPortion = z.infer<typeof proteinPortionSchema>;
export type BrothConsumption = z.infer<typeof brothConsumptionSchema>;

// ---------------------------------------------------------------------------
// Composite types derived from Zod schemas
// ---------------------------------------------------------------------------

export type BodyMetrics = z.infer<typeof bodyMetricsSchema>;
export type CookingHabits = z.infer<typeof cookingHabitsSchema>;

// ---------------------------------------------------------------------------
// Types without corresponding schemas
// ---------------------------------------------------------------------------

export interface MacroTargets {
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
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
  // Screen 3 (was Screen 4)
  handSpanCm: number | null;
  knuckleDepthCm: number | null;
}
