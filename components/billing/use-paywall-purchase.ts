'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { useCallback, useRef, useState } from 'react';
import { toast } from 'sonner';
import { BillingIdentityMismatchError } from '@/lib/billing/identity';
import { type Package, purchasePackage } from '@/lib/billing/web-purchases';
import {
  clearActivationPending,
  markActivationPending,
} from './activation-pending';
import { pollUntilPremium } from './paywall-activation';

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
      try {
        const result = await purchasePackage(userId, rcPackage, {
          selectedLocale: locale,
        });

        if (result.status === 'cancelled') {
          // Explicitly dismissed, so no money moved and nothing needs healing.
          clearActivationPending(userId);
          return;
        }
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
    reset,
  };
}
