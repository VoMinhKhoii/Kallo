'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { useCallback, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import {
  entitlementsKeys,
  reconcileEntitlements,
  useEntitlements,
} from '@/hooks/billing/use-entitlements';
import { BillingIdentityMismatchError } from '@/lib/billing/identity';
import { isAllowedWebProduct } from '@/lib/billing/products';
import {
  getOfferings,
  type Package,
  purchasePackage,
} from '@/lib/billing/web-purchases';
import {
  clearActivationPending,
  markActivationPending,
} from './activation-pending';
import { pollUntilPremium } from './paywall-activation';
import { PaywallOffer } from './paywall-offer';
import { PaywallStatus } from './paywall-status';

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
 */
export function PaywallDialog({
  open,
  onOpenChange,
  userId,
}: PaywallDialogProps) {
  const t = useTranslations('billing.paywall');
  const locale = useLocale();
  const queryClient = useQueryClient();
  const { data: entitlements } = useEntitlements(userId);

  const [pendingId, setPendingId] = useState<string | null>(null);
  const [succeeded, setSucceeded] = useState(false);
  const [activationPending, setActivationPending] = useState(false);
  const [checkingActivation, setCheckingActivation] = useState(false);
  const activationAttempt = useRef(0);

  const offeringsQuery = useQuery({
    queryKey: ['billing', 'offerings', userId],
    queryFn: async () => {
      const current = await reconcileEntitlements(userId);
      queryClient.setQueryData(entitlementsKeys.user(userId), current);
      if (current.tier === 'premium') return null;
      return getOfferings(userId);
    },
    enabled: open && entitlements?.purchasesEnabled === true,
    staleTime: 5 * 60 * 1000,
  });

  const packages =
    offeringsQuery.data?.availablePackages.filter((pkg) => {
      const allowed = isAllowedWebProduct(pkg.webBillingProduct.identifier);
      if (!allowed) {
        console.error(
          `[billing] Ignoring unexpected web product: ${pkg.webBillingProduct.identifier}`
        );
      }
      return allowed;
    }) ?? [];
  const purchasing = pendingId !== null;

  const handleSelect = useCallback(
    async (rcPackage: Package) => {
      if (purchasing) return;
      setPendingId(rcPackage.identifier);
      try {
        const result = await purchasePackage(userId, rcPackage, {
          selectedLocale: locale,
        });

        if (result.status === 'cancelled') {
          // User dismissed the checkout — stay silent.
          return;
        }
        if (result.status === 'payment_pending') {
          markActivationPending(userId);
          setActivationPending(true);
          toast.success(t('pendingToast'));
          return;
        }

        // Money has moved. Record that before polling, so a reload, a crash, or
        // a closed tab mid-activation still leaves the lifecycle sync a reason
        // to contact the provider later — the server cannot infer this state
        // when no grant row exists.
        markActivationPending(userId);

        // Both a fresh success and an already-owned account should settle into
        // premium; poll the server until the webhook catches up.
        const attempt = ++activationAttempt.current;
        setCheckingActivation(true);
        const flipped = await pollUntilPremium(
          queryClient,
          userId,
          () => activationAttempt.current === attempt
        );
        if (activationAttempt.current !== attempt) return;
        if (flipped) {
          clearActivationPending(userId);
          setSucceeded(true);
          toast.success(t('successToast'));
        } else {
          setActivationPending(true);
          toast.success(t('successPendingToast'));
        }
      } catch (error) {
        console.error('Web purchase failed:', error);
        toast.error(
          error instanceof BillingIdentityMismatchError
            ? t('sessionChangedToast')
            : t('errorToast')
        );
      } finally {
        setCheckingActivation(false);
        setPendingId(null);
      }
    },
    [purchasing, userId, locale, queryClient, t]
  );

  const handleOpenChange = useCallback(
    (next: boolean) => {
      if (purchasing) return;
      if (!next) {
        activationAttempt.current += 1;
        setSucceeded(false);
        setActivationPending(false);
        setCheckingActivation(false);
      }
      onOpenChange(next);
    },
    [purchasing, onOpenChange]
  );

  const handleStatusAction = useCallback(async () => {
    if (!activationPending) {
      handleOpenChange(false);
      return;
    }

    setCheckingActivation(true);
    const attempt = ++activationAttempt.current;
    try {
      const flipped = await pollUntilPremium(
        queryClient,
        userId,
        () => activationAttempt.current === attempt
      );
      if (activationAttempt.current !== attempt) return;
      if (flipped) {
        clearActivationPending(userId);
        setActivationPending(false);
        setSucceeded(true);
      }
    } finally {
      if (activationAttempt.current === attempt) {
        setCheckingActivation(false);
      }
    }
  }, [activationPending, handleOpenChange, queryClient, userId]);

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
    <Dialog modal={!purchasing} open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[min(90dvh,48rem)] max-w-md gap-0 overflow-y-auto overscroll-contain rounded-2xl border-nham-border/70 bg-nham-surface p-0">
        {succeeded || activationPending ? (
          <PaywallStatus
            activationPending={activationPending}
            checkingActivation={checkingActivation}
            onAction={handleStatusAction}
          />
        ) : (
          <PaywallOffer
            trialActive={trialActive}
            daysRemaining={daysRemaining}
            packages={packages}
            pendingId={pendingId}
            purchasing={purchasing}
            offeringsPending={offeringsQuery.isPending}
            offeringsFailed={offeringsQuery.isError}
            onSelect={handleSelect}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
