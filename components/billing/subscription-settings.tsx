'use client';

import { ExternalLink, Loader2, Sparkles } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { useEntitlements } from '@/hooks/billing/use-entitlements';
import { ExpiryReminderBanner } from './expiry-reminder-banner';
import { PaywallDialog } from './paywall-dialog';

// App-store management deep links for grants that originate from a mobile IAP.
// The RC webhook records the originating store (event.store lowercased) on the
// grant `store` column — `source` is always 'revenuecat' and can't be branched
// on. Anything not in this map (paddle, ...) is web-managed via management_url.

function daysUntil(iso: string | null): number {
  if (!iso) return Number.POSITIVE_INFINITY;
  const ms = new Date(iso).getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / (24 * 60 * 60 * 1000)));
}

function formatDate(iso: string | null, locale: string): string | null {
  if (!iso) return null;
  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(new Date(iso));
}

/**
 * Subscription section for the settings page. Reflects the user's current
 * entitlement state and offers the right next action per source:
 *  - free       → upgrade CTA into the paywall
 *  - trial      → days remaining + upgrade CTA
 *  - premium/web→ manage via the Paddle customer portal
 *  - premium/app→ "manage in App Store / Google Play" deep link
 *  - lifetime   → no expiry, no management
 */
export function SubscriptionSettings({
  userId,
  locale,
  email,
}: {
  userId: string;
  locale: string;
  email?: string | null;
}) {
  const t = useTranslations('billing.settings');
  const { data, isPending, isError } = useEntitlements(userId);
  const [paywallOpen, setPaywallOpen] = useState(false);

  if (isPending) {
    return (
      <div className="flex items-center gap-2 rounded-2xl border border-kallo-border/70 bg-white px-4 py-5 text-[14px] text-kallo-text-muted">
        <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
        {t('loading')}
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="rounded-2xl border border-kallo-border/70 bg-white px-4 py-5 text-[14px] text-kallo-text-muted">
        {t('loadError')}
      </div>
    );
  }

  if (!data.purchasesEnabled && data.tier !== 'premium') return null;

  const expiryDays = daysUntil(data.expiresAt);
  const showExpiryBanner =
    data.tier === 'premium' &&
    !data.isLifetime &&
    !data.willRenew &&
    expiryDays <= 5;

  return (
    <div className="flex flex-col gap-3 font-sans-display">
      {showExpiryBanner && <ExpiryReminderBanner daysRemaining={expiryDays} />}

      <div className="rounded-2xl border border-kallo-border/70 bg-white px-4 py-4">
        {data.tier === 'premium' ? (
          <PremiumState data={data} locale={locale} t={t} />
        ) : (
          <FreeState
            trialActive={data.trial.active}
            daysRemaining={data.trial.daysRemaining}
            onUpgrade={() => setPaywallOpen(true)}
            t={t}
          />
        )}
      </div>

      <PaywallDialog
        key={userId}
        open={paywallOpen}
        onOpenChange={setPaywallOpen}
        userId={userId}
        email={email}
      />
    </div>
  );
}

function FreeState({
  trialActive,
  daysRemaining,
  onUpgrade,
  t,
}: {
  trialActive: boolean;
  daysRemaining: number;
  onUpgrade: () => void;
  t: ReturnType<typeof useTranslations>;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="flex items-center gap-1.5 text-[15px] text-kallo-text">
          <Sparkles aria-hidden="true" className="h-4 w-4 text-kallo-accent" />
          {trialActive ? t('trialPlan') : t('freePlan')}
        </p>
        <p className="mt-0.5 text-[13px] text-kallo-text-muted">
          {trialActive
            ? t('trialRemaining', { days: daysRemaining })
            : t('freeDescription')}
        </p>
      </div>
      <button
        type="button"
        onClick={onUpgrade}
        className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-xl bg-kallo-ink px-4 py-2 font-medium text-[14px] text-kallo-surface transition-colors hover:bg-kallo-ink-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kallo-accent"
      >
        {t('upgradeCta')}
      </button>
    </div>
  );
}

function PremiumState({
  data,
  locale,
  t,
}: {
  data: NonNullable<ReturnType<typeof useEntitlements>['data']>;
  locale: string;
  t: ReturnType<typeof useTranslations>;
}) {
  const renewalDate = formatDate(data.expiresAt, locale);

  return (
    <div className="flex flex-col gap-3">
      <div>
        <p className="flex items-center gap-1.5 text-[15px] text-kallo-text">
          <Sparkles aria-hidden="true" className="h-4 w-4 text-kallo-accent" />
          {data.isLifetime ? t('lifetimePlan') : t('premiumPlan')}
        </p>
        <p className="mt-0.5 text-[13px] text-kallo-text-muted">
          {data.isLifetime
            ? t('lifetimeDescription')
            : data.willRenew && renewalDate
              ? t('renewsOn', { date: renewalDate })
              : renewalDate
                ? t('expiresOn', { date: renewalDate })
                : t('premiumDescription')}
        </p>
        {data.isLifetime && data.hasActiveSubscription && (
          <p className="mt-1 text-[13px] text-kallo-danger">
            {t('lifetimeSubscriptionWarning')}
          </p>
        )}
      </div>

      {data.hasActiveSubscription && (
        <div className="border-kallo-border/60 border-t pt-3">
          {data.managementUrl ? (
            <a
              href={data.managementUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-xl border border-kallo-border bg-kallo-surface px-3.5 py-2 font-medium text-[13px] text-kallo-text transition-colors hover:bg-kallo-hover/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kallo-accent"
            >
              <ExternalLink aria-hidden="true" className="h-3.5 w-3.5" />
              {data.managementStore === 'app_store'
                ? t('manageAppStore')
                : data.managementStore === 'play_store'
                  ? t('managePlayStore')
                  : t('manageWeb')}
            </a>
          ) : (
            <p className="text-[13px] text-kallo-text-muted leading-relaxed">
              {t('manageUnavailable')}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
