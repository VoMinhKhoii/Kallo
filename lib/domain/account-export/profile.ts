import { eq } from 'drizzle-orm';
import type { AppDb } from '@/lib/infra/db/client';
import { publicProfiles, userProfiles } from '@/lib/infra/db/schema';

/**
 * Explicit field-by-field pick of the user's profile row for the export.
 * Spelled out (rather than passing `$inferSelect` through) so a future
 * column must be consciously added here before it ships in the export —
 * nothing auto-leaks. Covers everything the user owns today: body metrics,
 * goal + targets, origin/locale, sharing preference, cooking habits, and
 * onboarding progress.
 */
function pickProfileExport(row: typeof userProfiles.$inferSelect) {
  return {
    userId: row.userId,
    // Body metrics
    weightKg: row.weightKg,
    heightCm: row.heightCm,
    age: row.age,
    biologicalSex: row.biologicalSex,
    activityLevel: row.activityLevel,
    tdeeKcal: row.tdeeKcal,
    // Goal & targets
    goal: row.goal,
    aggression: row.aggression,
    calorieTarget: row.calorieTarget,
    proteinTargetG: row.proteinTargetG,
    carbsTargetG: row.carbsTargetG,
    fatTargetG: row.fatTargetG,
    carbSplit: row.carbSplit,
    // Origin & language
    countryOfOrigin: row.countryOfOrigin,
    countryOfResidence: row.countryOfResidence,
    preferredLocale: row.preferredLocale,
    // Circle sharing preference
    autoShareToCircle: row.autoShareToCircle,
    // When the user last changed it (the consent record); null if never.
    autoShareUpdatedAt: row.autoShareUpdatedAt,
    // When the user agreed to third-party AI processing; null if never/withdrawn.
    aiProcessingConsentedAt: row.aiProcessingConsentedAt,
    // Cooking habits
    oilUsage: row.oilUsage,
    defaultRicePortion: row.defaultRicePortion,
    defaultProteinPortion: row.defaultProteinPortion,
    brothConsumption: row.brothConsumption,
    // Retired preference: nothing reads or writes it any more, but the column
    // still holds whatever the user once chose until it is dropped.
    sugarBraised: row.sugarBraised,
    // Onboarding progress
    onboardingStep: row.onboardingStep,
    onboardingCompletedAt: row.onboardingCompletedAt,
    onboardingMinimizedAt: row.onboardingMinimizedAt,
    // Record timestamps
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

/**
 * The Circle identity: the handle and display name friends see, plus where the
 * avatar comes from. `avatarPath` is a Storage object path, not the photo — the
 * bytes stay in the `avatars` bucket and are listed under `files`.
 */
function pickCircleProfileExport(row: typeof publicProfiles.$inferSelect) {
  return {
    handle: row.handle,
    displayName: row.displayName,
    avatarSeed: row.avatarSeed,
    avatarUrl: row.avatarUrl,
    avatarPath: row.avatarPath,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

/** The private profile (targets, body metrics) and the public Circle one. */
export async function loadProfileExport(db: AppDb, userId: string) {
  const [profileRows, circleRows] = await Promise.all([
    db
      .select()
      .from(userProfiles)
      .where(eq(userProfiles.userId, userId))
      .limit(1),
    db
      .select()
      .from(publicProfiles)
      .where(eq(publicProfiles.userId, userId))
      .limit(1),
  ]);

  return {
    profile: profileRows[0] ? pickProfileExport(profileRows[0]) : null,
    circleProfile: circleRows[0]
      ? pickCircleProfileExport(circleRows[0])
      : null,
  };
}
