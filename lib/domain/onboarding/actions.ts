'use server';

import { eq } from 'drizzle-orm';
import { Errors } from '@/lib/core/errors/catalog';
import {
  buildScreenUpdate,
  type ScreenUpdateOptions,
} from '@/lib/domain/onboarding/screen-update';
import { db } from '@/lib/infra/db/client';
import { userProfiles } from '@/lib/infra/db/schema';
import { createClient } from '@/lib/infra/supabase/server';

async function getAuthUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw Errors.notAuthenticated();
  return user;
}

export async function getOnboardingProfile() {
  const user = await getAuthUser();
  const rows = await db
    .select()
    .from(userProfiles)
    .where(eq(userProfiles.userId, user.id))
    .limit(1);
  return rows[0] ?? null;
}

export async function saveOnboardingScreen(
  step: number,
  data: Record<string, unknown>,
  options: ScreenUpdateOptions = { advance: true }
) {
  const user = await getAuthUser();

  const [existing] = await db
    .select()
    .from(userProfiles)
    .where(eq(userProfiles.userId, user.id))
    .limit(1);

  const updateObj = buildScreenUpdate(existing, step, data, options);
  // A Settings edit of an empty step has nothing to write.
  if (Object.keys(updateObj).length === 0) return { success: true };

  await db
    .update(userProfiles)
    .set(updateObj)
    .where(eq(userProfiles.userId, user.id));

  return { success: true };
}

export async function saveProfileSettings(data: Record<string, unknown>) {
  const user = await getAuthUser();

  const updateObj = {
    weightKg: String(data.weightKg),
    heightCm: data.heightCm as number,
    age: data.age as number,
    biologicalSex: data.biologicalSex as string,
    activityLevel: data.activityLevel as string,
    tdeeKcal: data.tdeeKcal as number,
    goal: data.goal as string,
    aggression:
      data.aggression != null
        ? String(data.aggression)
        : (null as string | null),
    carbSplit: data.carbSplit as string,
    calorieTarget: Math.max(Number(data.calorieTarget) || 0, 500),
    proteinTargetG: data.proteinTargetG as number,
    carbsTargetG: data.carbsTargetG as number,
    fatTargetG: data.fatTargetG as number,
    countryOfOrigin: (data.countryOfOrigin as string) ?? null,
    countryOfResidence: (data.countryOfResidence as string) ?? null,
    preferredLocale: (data.preferredLocale as string) ?? 'en',
    oilUsage: data.oilUsage as string,
    defaultRicePortion: data.defaultRicePortion as string,
    defaultProteinPortion: data.defaultProteinPortion as string,
    brothConsumption: data.brothConsumption as string,
  };

  // Does NOT touch onboardingStep or onboardingCompletedAt
  await db
    .update(userProfiles)
    .set(updateObj)
    .where(eq(userProfiles.userId, user.id));

  return { success: true };
}

/**
 * Minimize the onboarding nudge to its compact pill form. Records the
 * timestamp on the user's profile so the choice survives reloads and
 * cross-device sessions. Idempotent: setting again just refreshes the ts.
 */
export async function minimizeOnboardingNudge() {
  const user = await getAuthUser();
  const updated = await db
    .update(userProfiles)
    .set({ onboardingMinimizedAt: new Date() })
    .where(eq(userProfiles.userId, user.id))
    .returning({ userId: userProfiles.userId });
  if (updated.length === 0) {
    throw new Error('Profile not found');
  }
  return { success: true };
}

/**
 * Restore the onboarding nudge to its full form (clears the minimized
 * timestamp). Called when the user clicks the pill to resume — the parent
 * shows the wizard immediately, and the next reload will show the full
 * card again if the wizard was dismissed without progress.
 */
export async function restoreOnboardingNudge() {
  const user = await getAuthUser();
  const updated = await db
    .update(userProfiles)
    .set({ onboardingMinimizedAt: null })
    .where(eq(userProfiles.userId, user.id))
    .returning({ userId: userProfiles.userId });
  if (updated.length === 0) {
    throw new Error('Profile not found');
  }
  return { success: true };
}
