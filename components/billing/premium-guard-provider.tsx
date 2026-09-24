'use client';

import { useTranslations } from 'next-intl';
import { createContext, useCallback, useContext, useMemo } from 'react';
import { toast } from 'sonner';
import { useEntitlements } from '@/hooks/billing/use-entitlements';
import { useRouter } from '@/i18n/navigation';
import type { FeatureKey } from '@/lib/domain/billing/entitlement/features';
import { featureLocked } from '@/lib/domain/billing/entitlements-client';
import { pricingHref } from '@/lib/domain/billing/pricing/pricing-href';

interface PremiumGuardContextValue {
  /** Should this entry point paint a Premium chip? False while loading. */
  locked: (feature: FeatureKey) => boolean;
  /**
   * The interception helper: true when the action may proceed, false when it
   * must not — in which case the visitor has already been sent to /pricing.
   */
  requirePremium: (feature: FeatureKey) => boolean;
  /** Go to /pricing, with a back link to the current page. */
  openPaywall: () => void;
}

const PremiumGuardContext = createContext<PremiumGuardContextValue | null>(
  null
);

export function usePremiumGuard() {
  const ctx = useContext(PremiumGuardContext);
  if (!ctx) {
    throw new Error('usePremiumGuard must be used within PremiumGuardProvider');
  }
  return ctx;
}

/**
 * One entitlement read for the whole signed-in app.
 *
 * Every gated surface (logging, circle, nutrition) asks this provider instead
 * of threading entitlement props down. It is a UX layer only: the server gates
 * are the authority, so `locked` stays false while entitlements are loading and
 * whenever the enforcement kill-switch is off (see `featureLocked`).
 *
 * There is no paywall dialog: a locked feature's upgrade goes straight to
 * /pricing, which is the purchase page, with `?from=` so it can offer a way
 * back. The path is read at click time rather than subscribed to, so the
 * provider does not re-render the app on every navigation.
 *
 * With enforcement off the provider is inert by construction: no entitlement
 * query is issued, nothing is ever locked, and nothing navigates — the server
 * gates nothing either, so there is nothing to sell.
 */
export function PremiumGuardProvider({
  userId,
  enforcementEnabled,
  children,
}: {
  userId: string | null;
  /** Server-read BILLING_ENFORCEMENT_ENABLED kill-switch. */
  enforcementEnabled: boolean;
  children: React.ReactNode;
}) {
  const t = useTranslations('billing.premium');
  const router = useRouter();
  const { data } = useEntitlements(enforcementEnabled ? userId : null);

  const openPaywall = useCallback(() => {
    if (!enforcementEnabled) return;
    // Enforcement on but purchases off: /pricing could only show a disabled
    // button, so say so here instead — the action still stays refused.
    if (data && !data.purchasesEnabled) {
      toast.info(t('purchasesUnavailable'));
      return;
    }
    const { pathname, search } = window.location;
    router.push(pricingHref(`${pathname}${search}`));
  }, [enforcementEnabled, data, t, router]);

  const locked = useCallback(
    (feature: FeatureKey) => enforcementEnabled && featureLocked(data, feature),
    [enforcementEnabled, data]
  );

  const requirePremium = useCallback(
    (feature: FeatureKey) => {
      if (!locked(feature)) return true;
      openPaywall();
      return false;
    },
    [locked, openPaywall]
  );

  const value = useMemo(
    () => ({ locked, requirePremium, openPaywall }),
    [locked, requirePremium, openPaywall]
  );

  return (
    <PremiumGuardContext.Provider value={value}>
      {children}
    </PremiumGuardContext.Provider>
  );
}
