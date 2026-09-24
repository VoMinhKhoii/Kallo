'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import {
  clearActivationPending,
  markActivationPending,
} from '@/lib/domain/billing/activation/activation-pending';
import { pollUntilPremium } from '@/lib/domain/billing/activation/paywall-activation';
import { BillingIdentityMismatchError } from '@/lib/domain/billing/identity';
import {
  type Package,
  purchasePackage,
} from '@/lib/domain/billing/web-purchases';
import { track } from '@/lib/infra/telemetry/analytics/track';

/**
 * The paywall's purchase and activation state machine, kept apart from the
 * dialog that renders it.
 *
 * The split is not cosmetic: everything here is about money moving and the
 * server catching up, while the dialog is about what the user sees. The
 * generation counter below is the reason it has to be one cohesive unit — a
 * second purchase (or a closed dialog) must invalidate a poll still running
 * for the first, or a stale result flips the UI to "premium" for a purchase
 * that is no longer the current one.
 */
export function usePaywallPurchase(userId: string) {
  const t = useTranslations('billing.paywall');
  const locale = useLocale();
  const queryClient = useQueryClient();

  const [pendingId, setPendingId] = useState<string | null>(null);
  const [succeeded, setSucceeded] = useState(false);
  const [activationPending, setActivationPending] = useState(false);
  const [checkingActivation, setCheckingActivation] = useState(false);
  const activationAttempt = useRef(0);

  // Whose checkout this is. /pricing stays alive under <Activity> across a
  // sign-out or account switch, so a promise started for one account can
  // settle while another is on the page: every update after an await checks
  // it still belongs to the current user.
  const owner = useRef(userId);
  useEffect(() => {
    if (owner.current === userId) return;
    owner.current = userId;
    activationAttempt.current += 1; // cancels any poll still running
    setPendingId(null);
    setSucceeded(false);
    setActivationPending(false);
    setCheckingActivation(false);
  }, [userId]);

  const purchasing = pendingId !== null;

  const select = useCallback(
    async (rcPackage: Package) => {
      if (purchasing) return;
      setPendingId(rcPackage.identifier);
      // Record the attempt BEFORE handing control to the provider. The likeliest
      // interruption is the user paying and then closing the tab, which never
      // resolves the promise below — a marker written after it would be missing
      // in exactly the case it exists for. An abandoned checkout costs one
      // wasted reconcile; a lost one costs a customer their money.
      markActivationPending(userId);
      track('checkout_started', { package_id: rcPackage.identifier });
      try {
        const result = await purchasePackage(userId, rcPackage, {
          selectedLocale: locale,
        });
        if (owner.current !== userId) return;

        if (result.status === 'cancelled') {
          // Explicitly dismissed, so no money moved and nothing needs healing.
          clearActivationPending(userId);
          return;
        }
        track('purchase_completed', {
          package_id: rcPackage.identifier,
          status:
            result.status === 'payment_pending' ? 'payment_pending' : 'paid',
        });
        if (result.status === 'payment_pending') {
          setActivationPending(true);
          toast.success(t('pendingToast'));
          return;
        }

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
        track('purchase_failed', { package_id: rcPackage.identifier });
        toast.error(
          error instanceof BillingIdentityMismatchError
            ? t('sessionChangedToast')
            : t('errorToast')
        );
      } finally {
        if (owner.current === userId) {
          setCheckingActivation(false);
          setPendingId(null);
        }
      }
    },
    [purchasing, userId, locale, queryClient, t]
  );

  /** Retry the activation poll for a purchase the server has not projected. */
  const confirmActivation = useCallback(async () => {
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
  }, [queryClient, userId]);

  /**
   * Clear a finished purchase's receipt, e.g. when the page is shown again.
   * Unresolved state (payment pending, activation still being checked) is
   * kept: money may still be moving, and dropping it would bring the buy
   * button back while the first checkout settles.
   */
  const clearReceipt = useCallback(() => setSucceeded(false), []);

  /** Abandon any in-flight poll and clear the surface, e.g. on close. */
  const reset = useCallback(() => {
    activationAttempt.current += 1;
    setSucceeded(false);
    setActivationPending(false);
    setCheckingActivation(false);
  }, []);

  return {
    pendingId,
    purchasing,
    succeeded,
    activationPending,
    checkingActivation,
    select,
    confirmActivation,
    clearReceipt,
    reset,
  };
}
