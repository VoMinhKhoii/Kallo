'use server';

import { eq, inArray, sql } from 'drizzle-orm';
import { z } from 'zod';
import {
  markAccountDeletionReady,
  prepareAccountDeletion,
  processAccountDeletionJob,
} from '@/lib/account-deletion/jobs';
import { db } from '@/lib/db';
import {
  billingWebhookEvents,
  bodyWeightLog,
  entitlementGrants,
  mealItems,
  meals,
  userProfiles,
} from '@/lib/db/schema';
import { Errors } from '@/lib/errors';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

const accountActionInputSchema = z
  .object({ expectedUserId: z.string().uuid() })
  .strict();

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

async function requireExpectedUser(
  input: unknown,
  options: { recentAuth?: boolean } = {}
) {
  const parsed = accountActionInputSchema.safeParse(input);
  if (!parsed.success) {
    throw Errors.validationFailed('Invalid account action input.');
  }

  const session = await requireUser();
  if (session.user.id !== parsed.data.expectedUserId) {
    throw Errors.conflict(
      'Your signed-in account changed. Refresh the page and try again.'
    );
  }
  if (options.recentAuth) {
    const { data, error } = await session.supabase.auth.getClaims();
    const latestAuthentication = data?.claims.amr
      ?.filter(
        (entry): entry is { method: string; timestamp: number } =>
          typeof entry === 'object' &&
          entry !== null &&
          typeof entry.timestamp === 'number'
      )
      .reduce(
        (latest, entry) => Math.max(latest, entry.timestamp),
        Number.NEGATIVE_INFINITY
      );
    const nowSeconds = Date.now() / 1000;
    if (
      error ||
      latestAuthentication === undefined ||
      latestAuthentication < nowSeconds - 10 * 60 ||
      latestAuthentication > nowSeconds + 60
    ) {
      throw Errors.conflict(
        'For your security, sign in again before deleting your account.'
      );
    }
  }
  return session;
}

async function purgeAvatarObjects(
  admin: ReturnType<typeof createAdminClient>,
  userId: string
): Promise<void> {
  const bucket = admin.storage.from('avatars');
  for (;;) {
    const { data: objects, error: listError } = await bucket.list(userId, {
      limit: 100,
      offset: 0,
    });
    if (listError) throw listError;
    if (!objects?.length) return;
    const { error: removeError } = await bucket.remove(
      objects.map((object) => `${userId}/${object.name}`)
    );
    if (removeError) throw removeError;
  }
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
  billingGrants: (typeof entitlementGrants.$inferSelect)[];
}

async function deleteBillingAuditRowsForUser(userId: string): Promise<void> {
  await db.delete(billingWebhookEvents).where(sql`
    ${billingWebhookEvents.userId} = ${userId}::uuid
    OR ${billingWebhookEvents.rawPayload}->'event'->>'app_user_id' = ${userId}
    OR ${billingWebhookEvents.rawPayload}->'event'->>'original_app_user_id' = ${userId}
    OR (${billingWebhookEvents.rawPayload}->'event'->'aliases') ? ${userId}
    OR (${billingWebhookEvents.rawPayload}->'event'->'transferred_from') ? ${userId}
    OR (${billingWebhookEvents.rawPayload}->'event'->'transferred_to') ? ${userId}
    OR (${billingWebhookEvents.rawPayload}->'event'->'redeemed_from') ? ${userId}
    OR (${billingWebhookEvents.rawPayload}->'event'->'redeemed_by') ? ${userId}
  `);
}

/**
 * Build a complete JSON snapshot of everything we hold for the current user:
 * profile, every meal (with its items), and every weight entry. Returned to
 * the caller for download — App Store / GDPR-grade data portability.
 */
export async function exportMyDataAction(input: unknown): Promise<DataExport> {
  const { user } = await requireExpectedUser(input);

  const [profileRows, mealRows, weightRows, billingGrantRows] =
    await Promise.all([
      db
        .select()
        .from(userProfiles)
        .where(eq(userProfiles.userId, user.id))
        .limit(1),
      db.select().from(meals).where(eq(meals.userId, user.id)),
      db.select().from(bodyWeightLog).where(eq(bodyWeightLog.userId, user.id)),
      db
        .select()
        .from(entitlementGrants)
        .where(eq(entitlementGrants.userId, user.id)),
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
    billingGrants: billingGrantRows,
  };
}

/**
 * Permanently delete the current user's account. Deleting the `auth.users`
 * row via the service-role admin client cascades to every app table that
 * references it (`onDelete: 'cascade'` on profiles, meals → items, weights,
 * friendships, meal shares, coach assignments, circle events, pipeline rows…),
 * so the Auth deletion removes app-owned relational data atomically. Public
 * storage is purged first; provider erasure is persisted in an outbox and
 * retried after the local account is gone. There is no undo.
 */
export async function deleteAccountAction(
  input: unknown
): Promise<{ success: true }> {
  const { user, supabase } = await requireExpectedUser(input, {
    recentAuth: true,
  });
  // Resolve the privileged dependency before deleting anything. Preview/local
  // deployments intentionally omit this credential; they must fail without
  // partially erasing billing audit rows.
  const admin = createAdminClient();

  // Erasure is fail-closed while the user can still retry. A second pass after
  // auth deletion closes the narrow race with a webhook arriving between the
  // first cleanup and the auth cascade; future orphan deliveries are scrubbed
  // by the webhook handler before they are finalized.
  try {
    await deleteBillingAuditRowsForUser(user.id);
  } catch (cleanupError) {
    throw Errors.internal(
      cleanupError,
      'Could not remove your billing audit data. Please try again.'
    );
  }

  // Storage objects don't cascade with the auth user. Paginate until empty and
  // fail closed: once Auth is gone the user cannot retry an orphaned public
  // avatar cleanup.
  try {
    await purgeAvatarObjects(admin, user.id);
  } catch (storageError) {
    throw Errors.internal(
      storageError,
      'Could not remove your profile photo. Please try again.'
    );
  }

  // Persist the provider-erasure job before deleting Auth. RevenueCat Billing
  // cancellation/erasure happens only after the local account is committed;
  // transient provider failures are retried by the scheduled worker.
  const deletionJob = await prepareAccountDeletion(user.id);

  const { error } = await admin.auth.admin.deleteUser(user.id);
  if (error) {
    throw Errors.internal(
      error,
      'Could not delete your account. Please try again.'
    );
  }

  await markAccountDeletionReady(deletionJob.id).catch((jobError) => {
    console.error(
      '[account-delete] Failed to mark erasure job ready:',
      jobError
    );
  });
  await processAccountDeletionJob(deletionJob).catch((providerError) => {
    console.error(
      '[account-delete] RevenueCat erasure queued for retry:',
      providerError
    );
  });

  // Repeat after deletion to remove a webhook that raced the first pass. The
  // account is already gone at this point, so a transient cleanup failure is
  // logged for operations rather than falsely telling the user that account
  // deletion failed. Future orphan deliveries are scrubbed by the webhook
  // handler and retained envelopes are pruned by the billing retention job.
  try {
    await deleteBillingAuditRowsForUser(user.id);
  } catch (cleanupError) {
    console.error(
      '[account-delete] Failed to remove billing webhook audit rows:',
      cleanupError
    );
  }

  // The auth user (and, by cascade, all data) is gone. Best-effort clear of the
  // now-orphaned session cookies; ignore failures since the account no longer
  // exists.
  await supabase.auth.signOut().catch(() => {});

  return { success: true };
}
