import { z } from 'zod';

export const bodyMetricsSchema = z.object({
  biologicalSex: z.enum(['male', 'female']),
  weightKg: z.number().min(30).max(300),
  heightCm: z.number().int().min(100).max(250),
  age: z.number().int().min(13).max(100),
  activityLevel: z.enum([
    'sedentary',
    'light',
    'moderate',
    'very_active',
  ]),
});

export const goalSchema = z
  .object({
    goal: z.enum(['cutting', 'bulking', 'maintaining']),
    aggression: z
      .enum(['gentle', 'moderate', 'aggressive'])
      .nullable(),
    carbSplit: z.enum([
      'moderate_carb',
      'lower_carb',
      'higher_carb',
    ]),
    deficitOverride: z.number().min(50).max(1500).nullable(),
  })
  .superRefine((data, ctx) => {
    if (data.goal !== 'maintaining' && data.aggression === null) {
      ctx.addIssue({
        code: 'custom',
        path: ['aggression'],
        message:
          'Aggression level is required for cutting and bulking goals',
      });
    }
  });

export const regionalSchema = z.object({
  regionalProfile: z.enum([
    'mien_bac',
    'mien_trung',
    'mien_nam',
    'mien_tay',
  ]),
});

export const cookingHabitsSchema = z.object({
  oilUsage: z.enum(['minimal', 'normal', 'heavy']),
  fatTrim: z.enum(['trim', 'eat_all', 'by_dish']),
  boneAwareness: z.boolean(),
  defaultRicePortion: z.enum(['small', 'medium', 'large']),
  sugarBraised: z.enum(['low', 'medium', 'high']),
});

export const portionCalibrationSchema = z.object({
  handSpanCm: z.number().min(10).max(35).nullable(),
  knuckleDepthCm: z.number().min(1).max(5).nullable(),
  bowlSizeMl: z.number().int().default(200),
  plateSizeMl: z.number().int().default(400),
});

export type BodyMetricsInput = z.infer<typeof bodyMetricsSchema>;
export type GoalInput = z.infer<typeof goalSchema>;
export type RegionalInput = z.infer<typeof regionalSchema>;
export type CookingHabitsInput = z.infer<
  typeof cookingHabitsSchema
>;
export type PortionCalibrationInput = z.infer<
  typeof portionCalibrationSchema
>;
