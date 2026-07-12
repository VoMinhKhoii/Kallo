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
 *
 * PHASE E: mount this above the meal feed in the logging surface (e.g. inside
 * `components/logging/logging-shell.tsx`, passing the signed-in `userId`).
 */
export function TrialBanner({
  userId,
  email,
}: {
  userId: string;
  email?: string | null;
}) {
  const t = useTranslations('billing.trialBanner');
  const { data } = useEntitlements();
  const [paywallOpen, setPaywallOpen] = useState(false);

  // Hide once premium, or when there is no active trial to count down.
  if (!data || data.tier === 'premium' || !data.trial.active) return null;

  return (
    <>
      <div className="flex items-center justify-between gap-3 rounded-2xl border border-nham-accent/40 bg-nham-accent/5 px-4 py-3 font-sans-display">
        <div className="flex min-w-0 items-center gap-2.5">
          <Sparkles className="h-4 w-4 shrink-0 text-nham-accent" />
          <p className="min-w-0 text-[14px] text-nham-text">
            {t('daysRemaining', { days: data.trial.daysRemaining })}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setPaywallOpen(true)}
          className="shrink-0 rounded-xl bg-nham-ink px-3.5 py-1.5 font-medium text-[13px] text-nham-surface transition-colors hover:bg-nham-ink-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nham-accent"
        >
          {t('upgrade')}
        </button>
      </div>

      <PaywallDialog
        open={paywallOpen}
        onOpenChange={setPaywallOpen}
        userId={userId}
        email={email}
      />
    </>
  );
}
