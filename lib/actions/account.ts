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

export interface DataExport {
  exportedAt: string;
  account: { id: string; email: string | null };
  profile: typeof userProfiles.$inferSelect | null;
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
    profile: profileRows[0] ?? null,
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
