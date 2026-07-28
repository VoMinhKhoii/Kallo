import { and, eq, inArray, isNull, lte, or, sql } from 'drizzle-orm';
import { z } from 'zod';
import { getBillingEnvironment } from '@/lib/billing/revenuecat';
import { deleteRevenueCatCustomer } from '@/lib/billing/revenuecat-customer';
import { type AppDb, db as appDb } from '@/lib/db';
import { billingWebhookEvents } from '@/lib/db/schema';
import { createAdminClient } from '@/lib/supabase/admin';

const PREPARED = 'ACCOUNT_DELETION_PREPARED';
const READY = 'ACCOUNT_DELETION_READY';
const payloadSchema = z.object({
  accountDeletion: z.object({ userId: z.string().uuid() }),
});

export function authUserIsConfirmedAbsent(
  user: unknown,
  error: { status?: number; code?: string } | null
): boolean {
  return (
    !user && (!error || error.status === 404 || error.code === 'user_not_found')
  );
}

export interface AccountDeletionJob {
  id: string;
  userId: string;
}

/** Persist a provider-erasure outbox row before the local auth user vanishes. */
export async function prepareAccountDeletion(
  userId: string,
  database: AppDb = appDb
): Promise<AccountDeletionJob> {
  const environment = getBillingEnvironment();
  const rows = await database
    .insert(billingWebhookEvents)
    .values({
      source: 'revenuecat',
      externalEventId: `account-deletion:${userId}`,
      eventType: PREPARED,
      userId: null,
      rawPayload: { accountDeletion: { userId } },
      deploymentEnvironment: environment,
      environment,
      nextAttemptAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [
        billingWebhookEvents.source,
        billingWebhookEvents.externalEventId,
        billingWebhookEvents.deploymentEnvironment,
      ],
      set: {
        eventType: PREPARED,
        rawPayload: { accountDeletion: { userId } },
        processedAt: null,
        processingError: null,
        deadLetteredAt: null,
        nextAttemptAt: new Date(),
      },
    })
    .returning({ id: billingWebhookEvents.id });
  const id = rows[0]?.id;
  if (!id) throw new Error('account_deletion_job_not_persisted');
  return { id, userId };
}

export async function markAccountDeletionReady(
  jobId: string,
  database: AppDb = appDb
): Promise<void> {
  await database
    .update(billingWebhookEvents)
    .set({ eventType: READY, nextAttemptAt: new Date() })
    .where(eq(billingWebhookEvents.id, jobId));
}

/** Provider erasure is retryable after local account deletion has committed. */
export async function processAccountDeletionJob(
  job: AccountDeletionJob,
  database: AppDb = appDb
): Promise<void> {
  try {
    await deleteRevenueCatCustomer(job.userId);
    await database
      .delete(billingWebhookEvents)
      .where(eq(billingWebhookEvents.id, job.id));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'provider_error';
    await database
      .update(billingWebhookEvents)
      .set({
        attemptCount: sql`${billingWebhookEvents.attemptCount} + 1`,
        lastAttemptAt: new Date(),
        processingError: message.slice(0, 500),
        nextAttemptAt: sql`now() + interval '1 hour'`,
      })
      .where(eq(billingWebhookEvents.id, job.id));
    throw error;
  }
}

/** Process due jobs; PREPARED rows run only after Auth confirms user absence. */
export async function retryAccountDeletionJobs(
  database: AppDb = appDb
): Promise<{ processed: number; failed: number; skipped: number }> {
  const environment = getBillingEnvironment();
  const rows = await database
    .select({
      id: billingWebhookEvents.id,
      eventType: billingWebhookEvents.eventType,
      rawPayload: billingWebhookEvents.rawPayload,
    })
    .from(billingWebhookEvents)
    .where(
      and(
        eq(billingWebhookEvents.source, 'revenuecat'),
        eq(billingWebhookEvents.deploymentEnvironment, environment),
        inArray(billingWebhookEvents.eventType, [PREPARED, READY]),
        isNull(billingWebhookEvents.processedAt),
        or(
          isNull(billingWebhookEvents.nextAttemptAt),
          lte(billingWebhookEvents.nextAttemptAt, new Date())
        )
      )
    )
    .limit(100);

  const admin = createAdminClient();
  let processed = 0;
  let failed = 0;
  let skipped = 0;
  for (const row of rows) {
    const parsed = payloadSchema.safeParse(row.rawPayload);
    if (!parsed.success) {
      failed += 1;
      continue;
    }
    const job = { id: row.id, userId: parsed.data.accountDeletion.userId };
    if (row.eventType === PREPARED) {
      const { data, error } = await admin.auth.admin.getUserById(job.userId);
      if (data.user) {
        skipped += 1;
        continue;
      }
      const absent = authUserIsConfirmedAbsent(data.user, error);
      if (!absent) {
        failed += 1;
        continue;
      }
      await markAccountDeletionReady(job.id, database);
    }
    try {
      await processAccountDeletionJob(job, database);
      processed += 1;
    } catch {
      failed += 1;
    }
  }
  return { processed, failed, skipped };
}
