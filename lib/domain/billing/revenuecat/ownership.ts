import { lt, sql } from 'drizzle-orm';
import type { BillingEnvironment } from '@/lib/domain/billing/revenuecat/identity';
import type { AppDb } from '@/lib/infra/db';
import { billingProviderSyncs } from '@/lib/infra/db/schema';

// The `billing_provider_syncs` row for one (user, environment): who currently
// owns the RevenueCat receipt, and how far the provider clock has advanced.
// Both writers live here because they contend for the same row — an ownership
// event wins on the provider EVENT clock, an ordinary read wins on the
// CustomerInfo REQUEST clock, and the two clocks are deliberately independent.

type GrantTransaction = Parameters<Parameters<AppDb['transaction']>[0]>[0];

export class StaleOwnershipEventError extends Error {}

interface RevenueCatOwnershipClaim {
  userId: string;
  environment: BillingEnvironment;
  providerSyncedAt: Date;
  eventAt: Date;
  eventId: string;
  eventPriority: number;
  revoked: boolean;
}

export async function claimRevenueCatOwnershipEvent(
  tx: GrantTransaction,
  input: RevenueCatOwnershipClaim,
  now: Date
): Promise<boolean> {
  const accepted = await tx
    .insert(billingProviderSyncs)
    .values({
      userId: input.userId,
      source: 'revenuecat',
      environment: input.environment,
      providerSyncedAt: input.providerSyncedAt,
      ownershipEventAt: input.eventAt,
      ownershipEventId: input.eventId,
      ownershipEventPriority: input.eventPriority,
      ownershipRevoked: input.revoked,
      customerMissingSince: null,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [
        billingProviderSyncs.userId,
        billingProviderSyncs.source,
        billingProviderSyncs.environment,
      ],
      set: {
        // Interpolated Dates are serialized to ISO + cast to timestamptz:
        // a raw Date in a sql`` fragment bypasses drizzle's column codec and
        // the postgres driver cannot bind it (throws ERR_INVALID_ARG_TYPE).
        providerSyncedAt: sql`GREATEST(${billingProviderSyncs.providerSyncedAt}, ${input.providerSyncedAt.toISOString()}::timestamptz)`,
        ownershipEventAt: input.eventAt,
        ownershipEventId: input.eventId,
        ownershipEventPriority: input.eventPriority,
        ownershipRevoked: input.revoked,
        customerMissingSince: null,
        updatedAt: now,
      },
      setWhere: sql`
        ${billingProviderSyncs.ownershipEventAt} IS NULL
        OR ${billingProviderSyncs.ownershipEventAt} < ${input.eventAt.toISOString()}::timestamptz
        OR (
          ${billingProviderSyncs.ownershipEventAt} = ${input.eventAt.toISOString()}::timestamptz
          AND ${billingProviderSyncs.ownershipEventPriority} < ${input.eventPriority}
        )
        OR (
          ${billingProviderSyncs.ownershipEventAt} = ${input.eventAt.toISOString()}::timestamptz
          AND ${billingProviderSyncs.ownershipEventPriority} = ${input.eventPriority}
          AND COALESCE(${billingProviderSyncs.ownershipEventId}, '') < ${input.eventId}
        )
      `,
    })
    .returning({ id: billingProviderSyncs.id });

  return accepted.length > 0;
}

export interface RevenueCatSyncWatermark {
  userId: string;
  environment: BillingEnvironment;
  providerSyncedAt: Date;
}

/**
 * Move the CustomerInfo watermark forward. Returns false when a newer (or
 * equal) response already won, which is the caller's signal to drop the stale
 * read rather than project it.
 */
export async function advanceRevenueCatWatermark(
  tx: GrantTransaction,
  input: RevenueCatSyncWatermark,
  customerMissingSince: Date | null,
  now: Date
): Promise<boolean> {
  const accepted = await tx
    .insert(billingProviderSyncs)
    .values({
      userId: input.userId,
      source: 'revenuecat',
      environment: input.environment,
      providerSyncedAt: input.providerSyncedAt,
      customerMissingSince,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [
        billingProviderSyncs.userId,
        billingProviderSyncs.source,
        billingProviderSyncs.environment,
      ],
      set: {
        providerSyncedAt: input.providerSyncedAt,
        customerMissingSince,
        updatedAt: now,
      },
      setWhere: lt(
        billingProviderSyncs.providerSyncedAt,
        input.providerSyncedAt
      ),
    })
    .returning({ id: billingProviderSyncs.id });

  return accepted.length > 0;
}
