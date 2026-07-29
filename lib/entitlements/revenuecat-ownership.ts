import { sql } from 'drizzle-orm';
import type { AppDb } from '@/lib/db';
import { billingProviderSyncs } from '@/lib/db/schema';
import type { RevenueCatCustomerRevocation } from '@/lib/entitlements/grants';

type GrantTransaction = Parameters<Parameters<AppDb['transaction']>[0]>[0];

export class StaleOwnershipEventError extends Error {}

interface RevenueCatOwnershipClaim {
  userId: string;
  environment: RevenueCatCustomerRevocation['environment'];
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
