'use client';

import dynamic from 'next/dynamic';
import { useTranslations } from 'next-intl';
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react';
import { toast } from 'sonner';
import { useEntitlements } from '@/hooks/billing/use-entitlements';
import type { FeatureKey } from '@/lib/domain/billing/entitlement/features';
import { featureLocked } from '@/lib/domain/billing/entitlements-client';

// The dialog pulls the RevenueCat web SDK and the offerings queries with it.
// Loading it lazily (and never on the server) keeps that chunk out of the app
// shell for the far more common case where the paywall is never opened.
const PaywallDialog = dynamic(
  () =>
    import('@/components/billing/paywall/paywall-dialog').then(
      (mod) => mod.PaywallDialog
    ),
  { ssr: false }
);

interface PremiumGuardContextValue {
  /** Should this entry point paint a Premium chip? False while loading. */
  locked: (feature: FeatureKey) => boolean;
  /**
   * The interception helper: true when the action may proceed, false when it
   * must not — in which case the paywall has already been opened.
   */
  requirePremium: (feature: FeatureKey) => boolean;
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
 * One entitlement read and one PaywallDialog for the whole signed-in app.
 *
 * Every gated surface (logging, circle, nutrition) asks this provider instead
 * of threading entitlement props down, and shares the single hosted dialog
 * rather than mounting its own. It is a UX layer only: the server gates are
 * the authority, so `locked` stays false while entitlements are loading and
 * whenever the enforcement kill-switch is off (see `featureLocked`).
 *
 * With enforcement off the provider is inert by construction: no entitlement
 * query is issued, nothing is ever locked, and the paywall chunk is never
 * requested — the server gates nothing either, so there is nothing to sell.
 */
export function PremiumGuardProvider({
  userId,
  email = null,
  enforcementEnabled,
  children,
}: {
  userId: string | null;
  /** Signed-in user's email — pre-fills the web checkout. */
  email?: string | null;
  /** Server-read BILLING_ENFORCEMENT_ENABLED kill-switch. */
  enforcementEnabled: boolean;
  children: React.ReactNode;
}) {
  const t = useTranslations('billing.premium');
  const { data } = useEntitlements(enforcementEnabled ? userId : null);
  const [paywallOpen, setPaywallOpen] = useState(false);

  const openPaywall = useCallback(() => {
    if (!enforcementEnabled) return;
    // Enforcement on but purchases off: the dialog renders nothing at all
    // (see `PaywallDialog`), so opening it would be a silent dead end. Say so
    // instead — the action still stays refused.
    if (data && !data.purchasesEnabled) {
      toast.info(t('purchasesUnavailable'));
      return;
    }
    setPaywallOpen(true);
  }, [enforcementEnabled, data, t]);

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
      {enforcementEnabled && userId !== null && (
        <PaywallDialog
          key={userId}
          open={paywallOpen}
          onOpenChange={setPaywallOpen}
          userId={userId}
          email={email}
        />
      )}
    </PremiumGuardContext.Provider>
  );
}
