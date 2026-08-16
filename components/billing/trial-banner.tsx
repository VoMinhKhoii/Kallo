'use client';

import { Sparkles } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { useEntitlements } from '@/hooks/billing/use-entitlements';
import { PaywallDialog } from './paywall-dialog';

/**
 * Compact trial-status banner for the logging surface: shows days remaining in
 * the app-level trial and a CTA into the paywall. Renders nothing unless the
 * user is on an active trial and not already premium.
 */
export function TrialBanner({
  userId,
  email,
}: {
  userId: string;
  email?: string | null;
}) {
  const t = useTranslations('billing.trialBanner');
  const { data } = useEntitlements(userId);
  const [paywallOpen, setPaywallOpen] = useState(false);

  // Hide once premium, or when there is no active trial to count down.
  if (
    !data?.purchasesEnabled ||
    data.tier === 'premium' ||
    !data.trial.active
  ) {
    return null;
  }

  return (
    <>
      <div className="flex items-center justify-between gap-3 rounded-2xl border border-kallo-accent/40 bg-kallo-accent/5 px-4 py-3 font-sans-display">
        <div className="flex min-w-0 items-center gap-2.5">
          <Sparkles
            aria-hidden="true"
            className="h-4 w-4 shrink-0 text-kallo-accent"
          />
          <p className="min-w-0 text-[14px] text-kallo-text">
            {t('daysRemaining', { days: data.trial.daysRemaining })}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setPaywallOpen(true)}
          className="shrink-0 rounded-xl bg-kallo-ink px-3.5 py-1.5 font-medium text-[13px] text-kallo-surface transition-colors hover:bg-kallo-ink-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kallo-accent"
        >
          {t('upgrade')}
        </button>
      </div>

      <PaywallDialog
        key={userId}
        open={paywallOpen}
        onOpenChange={setPaywallOpen}
        userId={userId}
        email={email}
      />
    </>
  );
}
