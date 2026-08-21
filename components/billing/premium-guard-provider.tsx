'use client';

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react';
import { PaywallDialog } from '@/components/billing/paywall/paywall-dialog';
import { useEntitlements } from '@/hooks/billing/use-entitlements';
import type { FeatureKey } from '@/lib/domain/billing/entitlement/features';
import { featureLocked } from '@/lib/domain/billing/entitlements-client';

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
 */
export function PremiumGuardProvider({
  userId,
  email = null,
  children,
}: {
  userId: string | null;
  /** Signed-in user's email — pre-fills the web checkout. */
  email?: string | null;
  children: React.ReactNode;
}) {
  const { data } = useEntitlements(userId);
  const [paywallOpen, setPaywallOpen] = useState(false);

  const openPaywall = useCallback(() => setPaywallOpen(true), []);

  const locked = useCallback(
    (feature: FeatureKey) => featureLocked(data, feature),
    [data]
  );

  const requirePremium = useCallback(
    (feature: FeatureKey) => {
      if (!featureLocked(data, feature)) return true;
      setPaywallOpen(true);
      return false;
    },
    [data]
  );

  const value = useMemo(
    () => ({ locked, requirePremium, openPaywall }),
    [locked, requirePremium, openPaywall]
  );

  return (
    <PremiumGuardContext.Provider value={value}>
      {children}
      {userId !== null && (
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
