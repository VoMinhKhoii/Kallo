'use client';

import { useRouter } from 'next/navigation';
import { useLocale } from 'next-intl';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useEntitlements } from '@/hooks/billing/use-entitlements';
import { usePaywallOfferings } from '@/hooks/billing/use-paywall-offerings';
import { usePaywallPurchase } from '@/hooks/billing/use-paywall-purchase';
import {
  freeCtaState,
  packageForPeriod,
  premiumCtaState,
} from '@/lib/domain/billing/pricing/checkout-state';
import { pricesFromPackages } from '@/lib/domain/billing/pricing/offering-prices';
import type { BillingPeriod } from '@/lib/domain/billing/pricing/web-prices';
import { track } from '@/lib/infra/telemetry/analytics/track';
import {
  type LivePrices,
  type PricingCheckout,
  PricingCheckoutContext,
} from './checkout-context';
import { PricingRequestContext, type PricingVisitor } from './request-context';

/**
 * /pricing as the purchase page.
 *
 * The page shell is prerendered, so it paints signed out; `PricingRequest`
 * streams the session and `?from=` in behind `<Suspense>` and applies them
 * here. The hooks run unconditionally so the tree under the provider never
 * changes shape (and never remounts the cards) when the visitor becomes
 * known — with no user every query is disabled.
 *
 * Purchase and activation are the old paywall dialog's own hooks, unchanged:
 * the offering is read only while `purchasesEnabled` is on and the visitor is
 * not already Premium, and `usePaywallPurchase` owns the checkout and the
 * webhook-race poll.
 */
export function PricingCheckoutProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  // The shell paints before the session is read; until it is (null), nobody
  // may boot Paddle.js for a price preview (see `LivePrices`).
  const [visitor, setVisitor] = useState<PricingVisitor | null>(null);
  const userId = visitor?.userId ?? null;
  const router = useRouter();
  const locale = useLocale();

  const entitlements = useEntitlements(userId);
  const data = entitlements.data;
  const purchase = usePaywallPurchase(userId ?? '');
  const offerings = usePaywallOfferings({
    userId: userId ?? '',
    enabled:
      userId !== null &&
      data?.purchasesEnabled === true &&
      data.tier === 'free',
    reconciliationRequired: data?.reconciliationRequired === true,
  });

  const viewing = userId !== null && data?.tier === 'free';
  useEffect(() => {
    if (viewing) track('paywall_viewed', {});
  }, [viewing]);

  const { packages } = offerings;
  const { select } = purchase;
  const buy = useCallback(
    (period: BillingPeriod) => {
      const pkg = packageForPeriod(packages, period);
      if (pkg) void select(pkg);
    },
    [packages, select]
  );

  const premiumCta = useCallback(
    (period: BillingPeriod) =>
      userId === null
        ? 'sign-up'
        : premiumCtaState({
            tier: data?.tier ?? null,
            purchasesEnabled: data?.purchasesEnabled ?? null,
            entitlementsFailed: entitlements.isError,
            offeringsPending: offerings.isPending,
            offeringsFailed: offerings.isError,
            hasPackage: packageForPeriod(packages, period) !== null,
          }),
    [userId, data, entitlements.isError, offerings, packages]
  );

  const from = visitor?.from ?? null;
  const { activationPending, checkingActivation, confirmActivation } = purchase;
  const onStatusAction = useCallback(() => {
    if (activationPending) {
      void confirmActivation();
      return;
    }
    router.push(from ?? `/${locale}/dashboard`);
  }, [activationPending, confirmActivation, router, from, locale]);

  const showStatus = purchase.succeeded || activationPending;
  const resolved = visitor !== null;
  const live = useMemo<LivePrices>(() => {
    if (!resolved) return { source: 'none' };
    if (userId === null) return { source: 'paddle' };
    return { source: 'offering', prices: pricesFromPackages(packages) };
  }, [resolved, userId, packages]);
  const value = useMemo<PricingCheckout>(
    () => ({
      freeCta: userId === null ? 'sign-up' : freeCtaState(data?.tier ?? null),
      premiumCta,
      purchasing: purchase.purchasing,
      buy,
      status: showStatus
        ? { activationPending, checkingActivation, onAction: onStatusAction }
        : null,
      live,
    }),
    [
      userId,
      data?.tier,
      premiumCta,
      purchase.purchasing,
      buy,
      showStatus,
      activationPending,
      checkingActivation,
      onStatusAction,
      live,
    ]
  );

  const requestValue = useMemo(
    () => ({ visitor, applyVisitor: setVisitor }),
    [visitor]
  );

  return (
    <PricingRequestContext value={requestValue}>
      <PricingCheckoutContext value={value}>{children}</PricingCheckoutContext>
    </PricingRequestContext>
  );
}
