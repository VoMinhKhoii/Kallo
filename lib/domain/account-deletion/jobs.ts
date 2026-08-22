import { createHash } from 'node:crypto';
import { and, eq, inArray, isNull, lte, or, sql } from 'drizzle-orm';
import { z } from 'zod';
import {
  deleteRevenueCatCustomer,
  getBillingEnvironment,
} from '@/lib/domain/billing/billing';
import { type AppDb, db as appDb } from '@/lib/infra/db/client';
import { billingWebhookEvents } from '@/lib/infra/db/schema';
import { createAdminClient } from '@/lib/infra/supabase/admin';

const PREPARED = 'ACCOUNT_DELETION_PREPARED';
const READY = 'ACCOUNT_DELETION_READY';
const PROCESSING = 'ACCOUNT_DELETION_PROCESSING';
const COMPLETED = 'ACCOUNT_DELETION_COMPLETED';
const PROCESSING_LEASE_MS = 10 * 60 * 1000;
const payloadSchema = z.object({
  accountDeletion: z.object({ userId: z.string().uuid() }),
});

function accountDeletionExternalEventId(userId: string): string {
  const digest = createHash('sha256').update(userId).digest('hex');
  return `account-deletion:${digest}`;
}

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
  const externalEventId = accountDeletionExternalEventId(userId);
  const rows = await database
    .insert(billingWebhookEvents)
    .values({
      source: 'revenuecat',
      externalEventId,
      eventType: PREPARED,
      userId: null,
      rawPayload: { accountDeletion: { userId } },
      deploymentEnvironment: environment,
      environment,
      nextAttemptAt: new Date(),
    })
    .onConflictDoNothing({
      target: [
        billingWebhookEvents.source,
        billingWebhookEvents.externalEventId,
        billingWebhookEvents.deploymentEnvironment,
      ],
    })
    .returning({ id: billingWebhookEvents.id });
  const existingRows =
    rows.length > 0
      ? rows
      : await database
          .select({ id: billingWebhookEvents.id })
          .from(billingWebhookEvents)
          .where(
            and(
              eq(billingWebhookEvents.source, 'revenuecat'),
              eq(billingWebhookEvents.externalEventId, externalEventId),
              eq(billingWebhookEvents.deploymentEnvironment, environment)
            )
          )
          .limit(1);
  const id = existingRows[0]?.id;
  if (!id) throw new Error('account_deletion_job_not_persisted');
  return { id, userId };
}

export async function claimAccountDeletionJob(
  jobId: string,
  database: AppDb = appDb
): Promise<Date | null> {
  const now = new Date();
  const rows = await database
    .update(billingWebhookEvents)
    .set({
      eventType: PROCESSING,
      lastAttemptAt: now,
      processingError: null,
      nextAttemptAt: new Date(now.getTime() + PROCESSING_LEASE_MS),
    })
    .where(
      and(
        eq(billingWebhookEvents.id, jobId),
        inArray(billingWebhookEvents.eventType, [PREPARED, READY, PROCESSING]),
        or(
          isNull(billingWebhookEvents.nextAttemptAt),
          lte(billingWebhookEvents.nextAttemptAt, now)
        )
      )
    )
    .returning({ id: billingWebhookEvents.id });
  return rows.length === 1 ? now : null;
}

/** Provider erasure is retryable after local account deletion has committed. */
export async function processAccountDeletionJob(
  job: AccountDeletionJob,
  claimedAt: Date,
  database: AppDb = appDb
): Promise<void> {
  try {
    await deleteRevenueCatCustomer(job.userId);
    await database
      .update(billingWebhookEvents)
      .set({
        eventType: COMPLETED,
        rawPayload: { accountDeletion: { completed: true } },
        processedAt: new Date(),
        processingError: null,
        nextAttemptAt: null,
      })
      .where(
        and(
          eq(billingWebhookEvents.id, job.id),
          eq(billingWebhookEvents.eventType, PROCESSING),
          eq(billingWebhookEvents.lastAttemptAt, claimedAt)
        )
      );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'provider_error';
    await database
      .update(billingWebhookEvents)
      .set({
        eventType: READY,
        attemptCount: sql`${billingWebhookEvents.attemptCount} + 1`,
        lastAttemptAt: new Date(),
        processingError: message.slice(0, 500),
        nextAttemptAt: sql`now() + interval '1 hour'`,
      })
      .where(
        and(
          eq(billingWebhookEvents.id, job.id),
          eq(billingWebhookEvents.eventType, PROCESSING),
          eq(billingWebhookEvents.lastAttemptAt, claimedAt)
        )
      );
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
        inArray(billingWebhookEvents.eventType, [PREPARED, READY, PROCESSING]),
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
    }
    const claimedAt = await claimAccountDeletionJob(job.id, database);
    if (!claimedAt) {
      skipped += 1;
      continue;
    }
    try {
      await processAccountDeletionJob(job, claimedAt, database);
      processed += 1;
    } catch {
      failed += 1;
    }
  }
  return { processed, failed, skipped };
}
