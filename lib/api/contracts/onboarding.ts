/**
 * Contract for the onboarding + profile/settings REST surface
 * (`/api/v1/onboarding/*`, `/api/v1/profile`).
 *
 * Imported by the mobile (React Native) client, so this file must NEVER
 * value-import a server action or any 'server-only'/db/supabase module. It
 * contains only:
 *   - Zod request schemas depending solely on 'zod' and the PURE onboarding
 *     schema/constant modules (`@/lib/domain/onboarding/schemas`,
 *     `@/lib/domain/onboarding/constants` — verified to import neither 'server-only'
 *     nor db/supabase).
 *   - A `export type` re-export of `getOnboardingProfile` (the binding is
 *     erased at runtime, so this pulls no server code into the mobile bundle).
 */
import { z } from 'zod';
import { ONBOARDING_TOTAL_STEPS } from '@/lib/domain/onboarding/constants';
import {
  bodyMetricsSchema,
  carbSplitSchema,
  cookingHabitsSchema,
  countrySchema,
  goalEnumSchema,
} from '@/lib/domain/onboarding/schemas';

/**
 * Request body for `POST /api/v1/onboarding/screen` → `saveOnboardingScreen`.
 *
 * The action signature is POSITIONAL: `saveOnboardingScreen(step, data)`. The
 * route destructures `{ step, data }` and forwards them. `step` is a 1-based
 * onboarding step (1 = region/locale, 2 = body metrics + goal + computed
 * targets, 3 = cooking habits); `ONBOARDING_TOTAL_STEPS` is 3.
 *
 * `data` is intentionally a LOOSE passthrough record: the action does its own
 * step-keyed field extraction with NO internal validation, and treats an empty
 * object `{}` as the "Skip" action. Tightening `data` here would reject
 * payloads the action currently accepts.
 */
export const onboardingScreenSchema = z.object({
  step: z.number().int().min(1).max(ONBOARDING_TOTAL_STEPS),
  data: z.record(z.string(), z.unknown()),
});

export type OnboardingScreenInput = z.infer<typeof onboardingScreenSchema>;

/**
 * Request body for `PUT /api/v1/profile` → `saveProfileSettings(data)`.
 *
 * Mirrors EXACTLY what the web settings form submits (see
 * components/settings/profile/index.tsx): body metrics + goal + region +
 * cooking, plus the five client-computed daily targets.
 *
 * The goal block matches the web form's local `profileGoalSchema` — goal +
 * nullable `aggression` + `carbSplit`, with NO `deficitOverride` and NO
 * cross-field `superRefine`. This is deliberate, for true 1:1 parity:
 * `saveProfileSettings` never reads `deficitOverride`, and the web form does
 * not enforce "aggression required for cutting/bulking", so adding either here
 * would reject payloads the web accepts. (Unknown keys like a stray
 * `deficitOverride` are stripped by Zod, so onboarding-shaped payloads are
 * still accepted.) `preferredLocale` is optional — the action defaults it to
 * 'en' when absent.
 */
export const profileSettingsSchema = z.object({
  // body metrics (lib/onboarding/schemas.ts → bodyMetricsSchema)
  biologicalSex: bodyMetricsSchema.shape.biologicalSex,
  weightKg: bodyMetricsSchema.shape.weightKg,
  heightCm: bodyMetricsSchema.shape.heightCm,
  age: bodyMetricsSchema.shape.age,
  activityLevel: bodyMetricsSchema.shape.activityLevel,
  // goal — mirrors the web settings form's local profileGoalSchema exactly.
  goal: goalEnumSchema,
  aggression: z.number().min(0.1).max(0.8).nullable(),
  carbSplit: carbSplitSchema,
  // client-computed daily targets (the form calculates and submits these).
  tdeeKcal: z.number().int().positive(),
  calorieTarget: z.number().int().positive(),
  proteinTargetG: z.number().int().nonnegative(),
  carbsTargetG: z.number().int().nonnegative(),
  fatTargetG: z.number().int().nonnegative(),
  // region (lib/onboarding/schemas.ts → countrySchema) + optional locale.
  countryOfOrigin: countrySchema.shape.countryOfOrigin,
  countryOfResidence: countrySchema.shape.countryOfResidence,
  preferredLocale: z.string().trim().min(2).max(10).optional(),
  // cooking habits (lib/onboarding/schemas.ts → cookingHabitsSchema)
  oilUsage: cookingHabitsSchema.shape.oilUsage,
  defaultRicePortion: cookingHabitsSchema.shape.defaultRicePortion,
  sugarBraised: cookingHabitsSchema.shape.sugarBraised,
  defaultProteinPortion: cookingHabitsSchema.shape.defaultProteinPortion,
  brothConsumption: cookingHabitsSchema.shape.brothConsumption,
});

export type ProfileSettingsInput = z.infer<typeof profileSettingsSchema>;

/** Request body for `PUT /api/v1/profile/sharing`. */
export const sharingPreferencesSchema = z.object({
  autoShareToCircle: z.boolean(),
});

/**
 * Type-only re-export so the mobile client can type the
 * `GET /api/v1/onboarding/profile` response. The action has no named return
 * type — it returns an anonymous Drizzle row
 * (`typeof userProfiles.$inferSelect | null`). Derive it client-side with
 * `NonNullable<Awaited<ReturnType<typeof getOnboardingProfile>>>`, mirroring
 * the existing web components. `export type` erases the binding at runtime, so
 * no server/db code is bundled.
 */
export type { getOnboardingProfile } from '@/lib/domain/onboarding/actions';
