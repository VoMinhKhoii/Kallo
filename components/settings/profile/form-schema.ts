import type { DefaultValues } from 'react-hook-form';
import { z } from 'zod';
import type { SUBSECTION_ANCHOR } from '@/components/settings/anchors';
import type {
  cookingHabitsSchema,
  countrySchema,
  createBodyMetricsSchema,
} from '@/lib/onboarding/schemas';
import type {
  ActivityLevel,
  BrothConsumption,
  CarbSplit,
  Goal,
  OilUsage,
  ProteinPortion,
  RicePortion,
  SugarBraised,
} from '@/lib/onboarding/types';

export const profileGoalSchema = z.object({
  goal: z.enum(['cutting', 'bulking', 'maintaining']),
  aggression: z.number().min(0.1).max(0.8).nullable(),
  carbSplit: z.enum(['moderate_carb', 'lower_carb', 'higher_carb']),
});

export type ProfileFormValues = z.infer<
  ReturnType<typeof createBodyMetricsSchema>
> &
  z.infer<typeof profileGoalSchema> &
  z.infer<typeof countrySchema> &
  z.infer<typeof cookingHabitsSchema>;

type SubsectionId = keyof typeof SUBSECTION_ANCHOR;

// Which subsection owns each field, so an invalid submit can scroll to the
// subsection holding the first error instead of leaving it off-screen.
export const SECTION_FOR_FIELD: Partial<
  Record<keyof ProfileFormValues, SubsectionId>
> = {
  biologicalSex: 'body-metrics',
  weightKg: 'body-metrics',
  heightCm: 'body-metrics',
  age: 'body-metrics',
  activityLevel: 'body-metrics',
  goal: 'body-metrics',
  aggression: 'body-metrics',
  carbSplit: 'body-metrics',
  countryOfOrigin: 'regional',
  countryOfResidence: 'regional',
  oilUsage: 'cooking',
  defaultRicePortion: 'cooking',
  sugarBraised: 'cooking',
  defaultProteinPortion: 'cooking',
  brothConsumption: 'cooking',
};

export interface ProfileInput {
  weightKg: string | null;
  heightCm: number | null;
  age: number | null;
  biologicalSex: string | null;
  activityLevel: string | null;
  tdeeKcal: number | null;
  goal: string | null;
  aggression: string | null;
  carbSplit: string | null;
  calorieTarget: number | null;
  proteinTargetG: number | null;
  carbsTargetG: number | null;
  fatTargetG: number | null;
  countryOfOrigin: string | null;
  countryOfResidence: string | null;
  oilUsage: string | null;
  defaultRicePortion: string | null;
  sugarBraised: string | null;
  defaultProteinPortion: string | null;
  brothConsumption: string | null;
}

// Typed as DefaultValues (a deep-partial) — both useForm and form.reset
// accept it. This is what lets the body-metrics fields start genuinely empty
// (undefined) instead of being cast from a fabricated value; the schema's
// "required" rule then forces a real entry before save.
export function buildDefaultValues(
  profile: ProfileInput
): DefaultValues<ProfileFormValues> {
  return {
    // Body metrics are NOT defaulted to fabricated numbers. A user who
    // skipped onboarding has null weight/height/age/sex; pre-filling
    // 65kg/165cm/25y/male would let them save fabricated data as if it were
    // real (and silently recompute a target from it). Leave them empty so
    // the schema's "required" validation forces a real entry before save.
    biologicalSex: (profile.biologicalSex as 'male' | 'female') ?? undefined,
    weightKg: profile.weightKg ? Number(profile.weightKg) : undefined,
    heightCm: profile.heightCm ?? undefined,
    age: profile.age ?? undefined,
    activityLevel: (profile.activityLevel as ActivityLevel) ?? undefined,
    goal: (profile.goal as Goal) ?? 'maintaining',
    aggression: (() => {
      const raw = profile.aggression;
      if (!raw) return null;
      const n = Number(raw);
      return Number.isNaN(n) ? 0.5 : n;
    })(),
    carbSplit: (profile.carbSplit as CarbSplit) ?? 'moderate_carb',
    countryOfOrigin: profile.countryOfOrigin ?? null,
    countryOfResidence: profile.countryOfResidence ?? null,
    oilUsage: (profile.oilUsage as OilUsage) ?? 'normal',
    defaultRicePortion: (profile.defaultRicePortion as RicePortion) ?? 'medium',
    sugarBraised: (profile.sugarBraised as SugarBraised) ?? 'medium',
    defaultProteinPortion:
      (profile.defaultProteinPortion as ProteinPortion) ?? 'medium',
    brothConsumption: (profile.brothConsumption as BrothConsumption) ?? 'some',
  };
}
