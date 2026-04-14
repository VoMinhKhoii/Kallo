import { z } from 'zod';

// ---------------------------------------------------------------------------
// Standalone enum schemas (source of truth for enum values)
// ---------------------------------------------------------------------------

export const biologicalSexSchema = z.enum(['male', 'female']);
export const activityLevelSchema = z.enum([
  'sedentary',
  'light',
  'moderate',
  'very_active',
]);
export const goalEnumSchema = z.enum(['cutting', 'bulking', 'maintaining']);
export const carbSplitSchema = z.enum([
  'moderate_carb',
  'lower_carb',
  'higher_carb',
]);
export const oilUsageSchema = z.enum(['minimal', 'normal', 'heavy']);
export const ricePortionSchema = z.enum(['small', 'medium', 'large']);
export const sugarBraisedSchema = z.enum(['low', 'medium', 'high']);
export const proteinPortionSchema = z.enum(['small', 'medium', 'large']);
export const brothConsumptionSchema = z.enum(['leave_it', 'some', 'finish_it']);

// ---------------------------------------------------------------------------
// Runtime value arrays
// ---------------------------------------------------------------------------

export const BIOLOGICAL_SEX_VALUES = biologicalSexSchema.options;
export const ACTIVITY_LEVEL_VALUES = activityLevelSchema.options;
export const GOAL_VALUES = goalEnumSchema.options;
export const CARB_SPLIT_VALUES = carbSplitSchema.options;
export const OIL_USAGE_VALUES = oilUsageSchema.options;
export const RICE_PORTION_VALUES = ricePortionSchema.options;
export const SUGAR_BRAISED_VALUES = sugarBraisedSchema.options;
export const PROTEIN_PORTION_VALUES = proteinPortionSchema.options;
export const BROTH_CONSUMPTION_VALUES = brothConsumptionSchema.options;

// ---------------------------------------------------------------------------
// Composite object schemas
// ---------------------------------------------------------------------------

export const bodyMetricsSchema = z.object({
  biologicalSex: biologicalSexSchema,
  weightKg: z.number().min(30).max(300),
  heightCm: z.number().int().min(100).max(250),
  age: z.number().int().min(13).max(100),
  activityLevel: activityLevelSchema,
});

export const goalSchema = z
  .object({
    goal: goalEnumSchema,
    aggression: z.number().min(0.1).max(0.8).nullable(),
    carbSplit: carbSplitSchema,
    deficitOverride: z.number().min(50).max(1500).nullable(),
  })
  .superRefine((data, ctx) => {
    if (data.goal !== 'maintaining' && data.aggression === null) {
      ctx.addIssue({
        code: 'custom',
        path: ['aggression'],
        message: 'Aggression level is required for cutting and bulking goals',
      });
    }
  });

export const countrySchema = z.object({
  countryOfOrigin: z.string().nullable(),
  countryOfResidence: z.string().nullable(),
});

export const cookingHabitsSchema = z.object({
  oilUsage: oilUsageSchema,
  defaultRicePortion: ricePortionSchema,
  sugarBraised: sugarBraisedSchema,
  defaultProteinPortion: proteinPortionSchema,
  brothConsumption: brothConsumptionSchema,
});

export type BodyMetricsInput = z.infer<typeof bodyMetricsSchema>;
export type GoalInput = z.infer<typeof goalSchema>;
export type CountryInput = z.infer<typeof countrySchema>;
export type CookingHabitsInput = z.infer<typeof cookingHabitsSchema>;
