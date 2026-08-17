'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { hasActivationPending } from '@/lib/domain/billing/activation/activation-pending';
import {
  entitlementsKeys,
  fetchEntitlements,
  reconcileEntitlements,
} from '@/lib/domain/billing/entitlements-client';
import {
  canonicalProductId,
  isAllowedWebProduct,
} from '@/lib/domain/billing/products';
import { getOfferings } from '@/lib/domain/billing/web-purchases';

interface PaywallOfferingsInput {
  /** The Supabase user id — the RC appUserId the offering is fetched for. */
  userId: string;
  /** The paywall is open and this account may buy. */
  enabled: boolean;
  /** The server's own staleness signal on the last snapshot it returned. */
  reconciliationRequired: boolean;
}

/**
 * What the paywall may offer this user right now.
 *
 * Reads a fresh entitlement snapshot before touching the provider, so a user
 * who is already premium is never shown packages, then loads the offering and
 * keeps only the products our web catalog sells.
 */
export function usePaywallOfferings({
  userId,
  enabled,
  reconciliationRequired,
}: PaywallOfferingsInput) {
  const queryClient = useQueryClient();

  const offeringsQuery = useQuery({
    queryKey: ['billing', 'offerings', userId],
    queryFn: async () => {
      // A cheap server read is enough to avoid offering packages to someone who
      // is already premium. Spend a provider reconcile only when the server
      // asks for one, or when an earlier checkout is still unaccounted for:
      // the endpoint allows 3/min, and the post-purchase activation poll needs
      // that budget far more than the paywall's opening frame does.
      const needsProvider =
        reconciliationRequired || hasActivationPending(userId);
      const current = needsProvider
        ? await reconcileEntitlements(userId)
        : await fetchEntitlements(userId);
      queryClient.setQueryData(entitlementsKeys.user(userId), current);
      if (current.tier === 'premium') return null;
      return getOfferings(userId);
    },
    enabled,
    staleTime: 5 * 60 * 1000,
  });

  const packages =
    offeringsQuery.data?.availablePackages.filter((pkg) => {
      const identifier = pkg.webBillingProduct.identifier;
      const allowed = isAllowedWebProduct(identifier);
      // A deliberately deferred plan (lifetime today) is filtered on purpose
      // and must stay quiet — the offering is shared with iOS and Android, so
      // it arrives here on every load. Only an id our catalog cannot resolve
      // at all is a real misconfiguration worth shouting about.
      if (!allowed && canonicalProductId(identifier) === null) {
        console.error(
          `[billing] Ignoring unexpected web product: ${identifier}`
        );
      }
      return allowed;
    }) ?? [];

  return {
    packages,
    isPending: offeringsQuery.isPending,
    isError: offeringsQuery.isError,
  };
}
