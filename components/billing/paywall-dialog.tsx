'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Sparkles } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useCallback, useState } from 'react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import {
  type EntitlementsResponse,
  entitlementsKeys,
  useEntitlements,
} from '@/hooks/billing/use-entitlements';
import {
  getOfferings,
  type Package,
  purchasePackage,
  webPurchasesEnabled,
} from '@/lib/billing/web-purchases';
import { cn } from '@/lib/utils';
import { PackageCard } from './package-card';

interface PaywallDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The Supabase user id — the RC appUserId the webhook keys grants on. */
  userId: string;
  /** Optional email to pre-fill the checkout and skip the email step. */
  email?: string | null;
}

// Webhook-race polling: after a successful checkout the client is ahead of the
// server, which only learns of the grant when RC's webhook lands. Poll the
// entitlements query on a fixed 2s cadence for up to ~30s until tier flips.
const POLL_INTERVAL_MS = 2000;
const POLL_MAX_ATTEMPTS = 15;

async function pollUntilPremium(
  queryClient: ReturnType<typeof useQueryClient>
): Promise<boolean> {
  for (let attempt = 0; attempt < POLL_MAX_ATTEMPTS; attempt++) {
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
    await queryClient.invalidateQueries({ queryKey: entitlementsKeys.all });
    const data = queryClient.getQueryData<EntitlementsResponse>(
      entitlementsKeys.all
    );
    if (data?.tier === 'premium') return true;
  }
  return false;
}

/**
 * The Nhẩm premium paywall. Pitches AI meal analysis, shows the live trial
 * countdown, lists offering packages with live prices, and runs the purchase +
 * webhook-race poll. All copy is translated (vi + en).
 */
export function PaywallDialog({
  open,
  onOpenChange,
  userId,
  email,
}: PaywallDialogProps) {
  const t = useTranslations('billing.paywall');
  const locale = useLocale();
  const queryClient = useQueryClient();
  const { data: entitlements } = useEntitlements();

  const [pendingId, setPendingId] = useState<string | null>(null);
  const [succeeded, setSucceeded] = useState(false);

  const offeringsQuery = useQuery({
    queryKey: ['billing', 'offerings', userId],
    queryFn: () => getOfferings(userId),
    enabled: open && webPurchasesEnabled,
    staleTime: 5 * 60 * 1000,
  });

  const packages = offeringsQuery.data?.availablePackages ?? [];
  const purchasing = pendingId !== null;

  const handleSelect = useCallback(
    async (rcPackage: Package) => {
      if (purchasing) return;
      setPendingId(rcPackage.identifier);
      try {
        const result = await purchasePackage(userId, rcPackage, {
          customerEmail: email ?? undefined,
          selectedLocale: locale,
        });

        if (result.status === 'cancelled') {
          // User dismissed the checkout — stay silent.
          return;
        }

        // Both a fresh success and an already-owned account should settle into
        // premium; poll the server until the webhook catches up.
        const flipped = await pollUntilPremium(queryClient);
        if (flipped) {
          setSucceeded(true);
          toast.success(t('successToast'));
        } else {
          // Payment went through but the grant hasn't landed yet — reassure
          // rather than error; the next entitlements refetch will resolve it.
          setSucceeded(true);
          toast.success(t('successPendingToast'));
        }
      } catch (error) {
        console.error('Web purchase failed:', error);
        toast.error(t('errorToast'));
      } finally {
        setPendingId(null);
      }
    },
    [purchasing, userId, email, locale, queryClient, t]
  );

  const handleOpenChange = useCallback(
    (next: boolean) => {
      if (purchasing) return; // don't close mid-checkout
      if (!next) setSucceeded(false);
      onOpenChange(next);
    },
    [purchasing, onOpenChange]
  );

  const trialActive = entitlements?.trial.active ?? false;
  const daysRemaining = entitlements?.trial.daysRemaining ?? 0;

  const perks = [t('perk1'), t('perk2'), t('perk3')];

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md gap-0 rounded-2xl border-nham-border/70 bg-nham-surface p-0">
        {succeeded ? (
          <div className="flex flex-col items-center px-6 py-10 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-nham-success/15">
              <Check className="h-6 w-6 text-nham-success" />
            </span>
            <DialogTitle className="mt-4 font-normal font-serif text-nham-text text-xl">
              {t('successTitle')}
            </DialogTitle>
            <DialogDescription className="mt-1.5 text-[14px] text-nham-text-soft">
              {t('successBody')}
            </DialogDescription>
            <button
              type="button"
              onClick={() => handleOpenChange(false)}
              className="mt-6 rounded-xl bg-nham-ink px-5 py-2.5 font-medium text-[14px] text-nham-surface transition-colors hover:bg-nham-ink-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nham-accent"
            >
              {t('successCta')}
            </button>
          </div>
        ) : (
          <div className="flex flex-col px-6 pt-6 pb-6">
            <header>
              <span className="inline-flex items-center gap-1.5 text-[11px] text-nham-accent uppercase tracking-[0.14em]">
                <Sparkles className="h-3.5 w-3.5" />
                {t('eyebrow')}
              </span>
              <DialogTitle className="mt-2 font-normal font-serif text-2xl text-nham-text leading-snug">
                {t('titleLead')}{' '}
                <span className="text-nham-accent italic [font-weight:300]">
                  {t('titleAccent')}
                </span>
              </DialogTitle>
              <DialogDescription className="mt-2 text-[14px] text-nham-text-soft leading-relaxed">
                {t('subtitle')}
              </DialogDescription>
            </header>

            {trialActive && (
              <p className="mt-3 rounded-xl bg-nham-hover/50 px-3.5 py-2.5 text-[13px] text-nham-text-soft">
                {t('trialCountdown', { days: daysRemaining })}
              </p>
            )}

            <ul className="mt-4 flex flex-col gap-2">
              {perks.map((perk) => (
                <li
                  key={perk}
                  className="flex items-start gap-2 text-[14px] text-nham-text"
                >
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-nham-accent" />
                  <span>{perk}</span>
                </li>
              ))}
            </ul>

            <div className="mt-5">
              {!webPurchasesEnabled || offeringsQuery.isError ? (
                <p className="rounded-xl border border-nham-border/70 bg-white px-4 py-4 text-center text-[13.5px] text-nham-text-muted">
                  {t('unavailable')}
                </p>
              ) : offeringsQuery.isPending ? (
                <div className="grid gap-3">
                  <Skeleton className="h-24 rounded-2xl" />
                  <Skeleton className="h-24 rounded-2xl" />
                </div>
              ) : packages.length === 0 ? (
                <p className="rounded-xl border border-nham-border/70 bg-white px-4 py-4 text-center text-[13.5px] text-nham-text-muted">
                  {t('unavailable')}
                </p>
              ) : (
                <div
                  className={cn(
                    'grid gap-3',
                    packages.length > 1 && 'sm:grid-cols-2'
                  )}
                >
                  {packages.map((pkg) => (
                    <PackageCard
                      key={pkg.identifier}
                      rcPackage={pkg}
                      pending={pendingId === pkg.identifier}
                      anyPending={purchasing}
                      onSelect={() => handleSelect(pkg)}
                    />
                  ))}
                </div>
              )}
            </div>

            <p className="mt-4 text-center text-[12px] text-nham-text-muted">
              {t('finetext')}
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
