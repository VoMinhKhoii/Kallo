import { eq } from 'drizzle-orm';
import type { AppDb } from '@/lib/infra/db/client';
import { billingProviderSyncs, entitlementGrants } from '@/lib/infra/db/schema';

/**
 * Premium access as Kallo records it: the grants (what the user is entitled to
 * and until when) and the per-provider sync watermarks behind them. Never card
 * data — the store or Paddle holds that, and none of it reaches us.
 *
 * The raw provider webhook envelopes are deliberately not here; see the
 * `billing_webhook_events` entry in `coverage.ts` for why.
 */
export async function loadBillingExport(db: AppDb, userId: string) {
  const [grantRows, syncRows] = await Promise.all([
    db
      .select()
      .from(entitlementGrants)
      .where(eq(entitlementGrants.userId, userId)),
    db
      .select({
        id: billingProviderSyncs.id,
        source: billingProviderSyncs.source,
        environment: billingProviderSyncs.environment,
        providerSyncedAt: billingProviderSyncs.providerSyncedAt,
        ownershipEventAt: billingProviderSyncs.ownershipEventAt,
        ownershipRevoked: billingProviderSyncs.ownershipRevoked,
        customerMissingSince: billingProviderSyncs.customerMissingSince,
        updatedAt: billingProviderSyncs.updatedAt,
      })
      .from(billingProviderSyncs)
      .where(eq(billingProviderSyncs.userId, userId)),
  ]);

  return { billingGrants: grantRows, billingSyncs: syncRows };
}
