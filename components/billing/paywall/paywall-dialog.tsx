'use client';

import { useCallback } from 'react';
import { PaywallStatus } from '@/components/billing/activation/paywall-status';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { useEntitlements } from '@/hooks/billing/use-entitlements';
import { usePaywallOfferings } from '@/hooks/billing/use-paywall-offerings';
import { usePaywallPurchase } from '@/hooks/billing/use-paywall-purchase';
import { PaywallOffer } from './paywall-offer';

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
 * Purchase and activation state lives in `usePaywallPurchase`, the offering in
 * `usePaywallOfferings`; this component only decides what the user sees.
 */
export function PaywallDialog({
  open,
  onOpenChange,
  userId,
}: PaywallDialogProps) {
  const { data: entitlements } = useEntitlements(userId);
  const purchase = usePaywallPurchase(userId);

  const offerings = usePaywallOfferings({
    userId,
    enabled: open && entitlements?.purchasesEnabled === true,
    reconciliationRequired: entitlements?.reconciliationRequired === true,
  });

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
      <DialogContent className="max-h-[min(90dvh,48rem)] max-w-md gap-0 overflow-y-auto overscroll-contain rounded-2xl border-kallo-border/70 bg-kallo-surface p-0">
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
            packages={offerings.packages}
            pendingId={purchase.pendingId}
            purchasing={purchase.purchasing}
            offeringsPending={offerings.isPending}
            offeringsFailed={offerings.isError}
            onSelect={purchase.select}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
