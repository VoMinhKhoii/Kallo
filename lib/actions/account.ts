'use server';

import { eq, inArray } from 'drizzle-orm';
import { db } from '@/lib/db';
import { bodyWeightLog, mealItems, meals, userProfiles } from '@/lib/db/schema';
import { Errors } from '@/lib/errors';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

/**
 * Resolve the current authenticated user WITHOUT requiring a completed
 * profile. Account-level actions (export, delete) must work for users who
 * signed up but skipped onboarding, so we can't use `requireAuthAndProfile`
 * here — it throws `profileNotFound` for profile-less accounts.
 */
async function requireUser() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) {
    throw Errors.notAuthenticated();
  }
  return { user: data.user, supabase };
}

/**
 * Explicit field-by-field pick of the user's profile row for the export.
 * Spelled out (rather than passing `$inferSelect` through) so a future
 * column must be consciously added here before it ships in the export —
 * nothing auto-leaks. Covers everything the user owns today: body metrics,
 * goal + targets, origin/locale, cooking habits, and onboarding progress.
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
    // Cooking habits
    oilUsage: row.oilUsage,
    defaultRicePortion: row.defaultRicePortion,
    sugarBraised: row.sugarBraised,
    defaultProteinPortion: row.defaultProteinPortion,
    brothConsumption: row.brothConsumption,
    // Onboarding progress
    onboardingStep: row.onboardingStep,
    onboardingCompletedAt: row.onboardingCompletedAt,
    onboardingMinimizedAt: row.onboardingMinimizedAt,
    // Record timestamps
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export type ProfileExport = ReturnType<typeof pickProfileExport>;

export interface DataExport {
  exportedAt: string;
  account: { id: string; email: string | null };
  profile: ProfileExport | null;
  meals: Array<
    typeof meals.$inferSelect & { items: (typeof mealItems.$inferSelect)[] }
  >;
  weights: (typeof bodyWeightLog.$inferSelect)[];
}

/**
 * Build a complete JSON snapshot of everything we hold for the current user:
 * profile, every meal (with its items), and every weight entry. Returned to
 * the caller for download — App Store / GDPR-grade data portability.
 */
export async function exportMyDataAction(): Promise<DataExport> {
  const { user } = await requireUser();

  const [profileRows, mealRows, weightRows] = await Promise.all([
    db
      .select()
      .from(userProfiles)
      .where(eq(userProfiles.userId, user.id))
      .limit(1),
    db.select().from(meals).where(eq(meals.userId, user.id)),
    db.select().from(bodyWeightLog).where(eq(bodyWeightLog.userId, user.id)),
  ]);

  const mealIds = mealRows.map((m) => m.id);
  const itemRows = mealIds.length
    ? await db
        .select()
        .from(mealItems)
        .where(inArray(mealItems.mealId, mealIds))
    : [];

  const itemsByMeal = new Map<string, (typeof mealItems.$inferSelect)[]>();
  for (const item of itemRows) {
    const bucket = itemsByMeal.get(item.mealId);
    if (bucket) {
      bucket.push(item);
    } else {
      itemsByMeal.set(item.mealId, [item]);
    }
  }

  return {
    exportedAt: new Date().toISOString(),
    account: { id: user.id, email: user.email ?? null },
    profile: profileRows[0] ? pickProfileExport(profileRows[0]) : null,
    meals: mealRows.map((meal) => ({
      ...meal,
      items: itemsByMeal.get(meal.id) ?? [],
    })),
    weights: weightRows,
  };
}

/**
 * Permanently delete the current user's account. Deleting the `auth.users`
 * row via the service-role admin client cascades to every app table that
 * references it (`onDelete: 'cascade'` on profiles, meals → items, weights,
 * friendships, meal shares, coach assignments, circle events, pipeline rows…),
 * so this single call removes all of the user's data atomically at the DB
 * level. We then clear the local session cookies. There is no undo.
 */
export async function deleteAccountAction(): Promise<{ success: true }> {
  const { user, supabase } = await requireUser();

  const admin = createAdminClient();

  // Storage objects don't cascade with the auth user — purge the (publicly
  // served) avatar photos first so a deleted account's photo doesn't stay
  // live. Best-effort: a storage error must not block the deletion itself.
  try {
    // Supabase storage returns { error } rather than throwing on API failures
    // (missing bucket, permission denied), so the try/catch alone would miss
    // them — inspect each result explicitly.
    const { data: objects, error: listError } = await admin.storage
      .from('avatars')
      .list(user.id, { limit: 100 });
    if (listError) {
      console.error('[account] avatar list failed:', listError);
    } else if (objects?.length) {
      const { error: removeError } = await admin.storage
        .from('avatars')
        .remove(objects.map((o) => `${user.id}/${o.name}`));
      if (removeError) {
        console.error('[account] avatar remove failed:', removeError);
      }
    }
  } catch (storageError) {
    console.error('[account] avatar purge threw:', storageError);
  }

  const { error } = await admin.auth.admin.deleteUser(user.id);
  if (error) {
    throw Errors.internal(
      error,
      'Could not delete your account. Please try again.'
    );
  }

  // The auth user (and, by cascade, all data) is gone. Best-effort clear of the
  // now-orphaned session cookies; ignore failures since the account no longer
  // exists.
  await supabase.auth.signOut().catch(() => {});

  return { success: true };
}
