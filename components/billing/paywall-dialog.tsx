'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import {
  entitlementsKeys,
  fetchEntitlements,
  reconcileEntitlements,
  useEntitlements,
} from '@/hooks/billing/use-entitlements';
import {
  canonicalProductId,
  isAllowedWebProduct,
} from '@/lib/billing/products';
import { getOfferings } from '@/lib/billing/web-purchases';
import { hasActivationPending } from './activation-pending';
import { PaywallOffer } from './paywall-offer';
import { PaywallStatus } from './paywall-status';
import { usePaywallPurchase } from './use-paywall-purchase';

interface PaywallDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The Supabase user id — the RC appUserId the webhook keys grants on. */
  userId: string;
  /** Legacy checkout-prefill input; the Paddle checkout owns email collection. */
  email?: string | null;
}

/**
 * The Kallo premium paywall. Pitches AI meal analysis, shows the live trial
 * countdown, lists offering packages with live prices, and runs the purchase +
 * webhook-race poll. All copy is translated (vi + en).
 *
 * Purchase and activation state lives in `usePaywallPurchase`; this component
 * owns which packages are offered and what the user sees.
 */
export function PaywallDialog({
  open,
  onOpenChange,
  userId,
}: PaywallDialogProps) {
  const queryClient = useQueryClient();
  const { data: entitlements } = useEntitlements(userId);
  const purchase = usePaywallPurchase(userId);

  const offeringsQuery = useQuery({
    queryKey: ['billing', 'offerings', userId],
    queryFn: async () => {
      // A cheap server read is enough to avoid offering packages to someone who
      // is already premium. Spend a provider reconcile only when the server
      // asks for one, or when an earlier checkout is still unaccounted for:
      // the endpoint allows 3/min, and the post-purchase activation poll needs
      // that budget far more than the paywall's opening frame does.
      const needsProvider =
        entitlements?.reconciliationRequired === true ||
        hasActivationPending(userId);
      const current = needsProvider
        ? await reconcileEntitlements(userId)
        : await fetchEntitlements(userId);
      queryClient.setQueryData(entitlementsKeys.user(userId), current);
      if (current.tier === 'premium') return null;
      return getOfferings(userId);
    },
    enabled: open && entitlements?.purchasesEnabled === true,
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

  const handleOpenChange = useCallback(
    (next: boolean) => {
      if (purchase.purchasing) return;
      if (!next) purchase.reset();
      onOpenChange(next);
    },
    [purchase, onOpenChange]
  );

  const handleStatusAction = useCallback(async () => {
    if (!purchase.activationPending) {
      handleOpenChange(false);
      return;
    }
    await purchase.confirmActivation();
  }, [purchase, handleOpenChange]);

  const trialActive = entitlements?.trial.active ?? false;
  const daysRemaining = entitlements?.trial.daysRemaining ?? 0;

  if (entitlements && !entitlements.purchasesEnabled) return null;

  return (
    // Non-modal while a checkout is open. Paddle mounts its checkout on
    // `document.body`, outside this dialog's portal, and a modal Radix dialog
    // sets `pointer-events: none` on the body and traps focus in its own
    // subtree — which leaves the payment form visible but completely
    // uninteractive. `handleOpenChange` already refuses to close mid-purchase,
    // so dropping modality here costs nothing but the scroll lock.
    <Dialog
      modal={!purchase.purchasing}
      open={open}
      onOpenChange={handleOpenChange}
    >
      <DialogContent className="max-h-[min(90dvh,48rem)] max-w-md gap-0 overflow-y-auto overscroll-contain rounded-2xl border-nham-border/70 bg-nham-surface p-0">
        {purchase.succeeded || purchase.activationPending ? (
          <PaywallStatus
            activationPending={purchase.activationPending}
            checkingActivation={purchase.checkingActivation}
            onAction={handleStatusAction}
          />
        ) : (
          <PaywallOffer
            trialActive={trialActive}
            daysRemaining={daysRemaining}
            packages={packages}
            pendingId={purchase.pendingId}
            purchasing={purchase.purchasing}
            offeringsPending={offeringsQuery.isPending}
            offeringsFailed={offeringsQuery.isError}
            onSelect={purchase.select}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
