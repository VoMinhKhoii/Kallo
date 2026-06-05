/**
 * Vendored verbatim from web `lib/onboarding/schemas.ts` (keep in sync). Pure
 * zod; used at runtime by react-hook-form's zodResolver. `bodyMetricsMessages`
 * takes a translator — use-intl's `useTranslations(...)` has the same
 * `(key) => string` call signature as next-intl, so it's reused as-is.
 */
import { z } from 'zod';

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

export const BIOLOGICAL_SEX_VALUES = biologicalSexSchema.options;
export const ACTIVITY_LEVEL_VALUES = activityLevelSchema.options;
export const GOAL_VALUES = goalEnumSchema.options;
export const CARB_SPLIT_VALUES = carbSplitSchema.options;
export const OIL_USAGE_VALUES = oilUsageSchema.options;
export const RICE_PORTION_VALUES = ricePortionSchema.options;
export const SUGAR_BRAISED_VALUES = sugarBraisedSchema.options;
export const PROTEIN_PORTION_VALUES = proteinPortionSchema.options;
export const BROTH_CONSUMPTION_VALUES = brothConsumptionSchema.options;

const countryFieldSchema = z
  .string()
  .trim()
  .max(100)
  .regex(/^[^<>\r\n]*$/, 'Country contains invalid characters')
  .nullable();

export const bodyMetricsSchema = z.object({
  biologicalSex: biologicalSexSchema,
  weightKg: z.number().min(30).max(300),
  heightCm: z.number().int().min(100).max(250),
  age: z.number().int().min(13).max(100),
  activityLevel: activityLevelSchema,
});

export interface BodyMetricsMessages {
  weightRequired: string;
  weightMin: string;
  weightMax: string;
  heightRequired: string;
  heightInt: string;
  heightMin: string;
  heightMax: string;
  ageRequired: string;
  ageInt: string;
  ageMin: string;
  ageMax: string;
}

export function createBodyMetricsSchema(m: BodyMetricsMessages) {
  return z.object({
    biologicalSex: biologicalSexSchema,
    weightKg: z
      .number({ error: m.weightRequired })
      .min(30, m.weightMin)
      .max(300, m.weightMax),
    heightCm: z
      .number({ error: m.heightRequired })
      .int(m.heightInt)
      .min(100, m.heightMin)
      .max(250, m.heightMax),
    age: z
      .number({ error: m.ageRequired })
      .int(m.ageInt)
      .min(13, m.ageMin)
      .max(100, m.ageMax),
    activityLevel: activityLevelSchema,
  });
}

export function bodyMetricsMessages(
  t: (key: string) => string
): BodyMetricsMessages {
  return {
    weightRequired: t('weightRequired'),
    weightMin: t('weightMin'),
    weightMax: t('weightMax'),
    heightRequired: t('heightRequired'),
    heightInt: t('heightInt'),
    heightMin: t('heightMin'),
    heightMax: t('heightMax'),
    ageRequired: t('ageRequired'),
    ageInt: t('ageInt'),
    ageMin: t('ageMin'),
    ageMax: t('ageMax'),
  };
}

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
  countryOfOrigin: countryFieldSchema,
  countryOfResidence: countryFieldSchema,
});

export const cookingHabitsSchema = z.object({
  oilUsage: oilUsageSchema,
  defaultRicePortion: ricePortionSchema,
  sugarBraised: sugarBraisedSchema,
  defaultProteinPortion: proteinPortionSchema,
  brothConsumption: brothConsumptionSchema,
});
