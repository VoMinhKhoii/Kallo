'use client';

import { Crown, ExternalLink } from 'lucide-react';
import type { useTranslations } from 'next-intl';
import type { useEntitlements } from '@/hooks/billing/use-entitlements';
import { Link } from '@/i18n/navigation';

// App-store management deep links for grants that originate from a mobile IAP.
// The RC webhook records the originating store (event.store lowercased) on the
// grant `store` column — `source` is always 'revenuecat' and can't be branched
// on. Anything not in this map (paddle, ...) is web-managed via management_url.

function formatDate(iso: string | null, locale: string): string | null {
  if (!iso) return null;
  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(new Date(iso));
}

export function PremiumState({
  data,
  locale,
  t,
  upgradeHref,
}: {
  data: NonNullable<ReturnType<typeof useEntitlements>['data']>;
  locale: string;
  t: ReturnType<typeof useTranslations>;
  // Set only for complimentary Premium: the user has not paid, so the row
  // offers Upgrade the way the Free row does.
  upgradeHref: string | null;
}) {
  const renewalDate = formatDate(data.expiresAt, locale);
  const manageUrl = data.hasActiveSubscription ? data.managementUrl : null;

  // "Manage subscription" sits on the right of the plan, the way "Upgrade"
  // does on the Free row, so both states read as one row with one action.
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-[15px] text-kallo-text">
            <Crown aria-hidden="true" className="h-4 w-4 text-kallo-accent" />
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

        {upgradeHref && (
          <Link
            href={upgradeHref}
            className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-xl bg-kallo-ink px-4 py-2 font-medium text-[14px] text-kallo-surface transition-colors hover:bg-kallo-ink-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kallo-accent"
          >
            {t('upgradeCta')}
          </Link>
        )}

        {manageUrl && (
          <a
            href={manageUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-xl border border-kallo-border bg-kallo-surface px-3.5 py-2 font-medium text-[13px] text-kallo-text transition-colors hover:bg-kallo-hover/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kallo-accent"
          >
            <ExternalLink aria-hidden="true" className="h-3.5 w-3.5" />
            {data.managementStore === 'app_store'
              ? t('manageAppStore')
              : data.managementStore === 'play_store'
                ? t('managePlayStore')
                : t('manageWeb')}
          </a>
        )}
      </div>

      {data.hasActiveSubscription && !manageUrl && (
        <p className="border-kallo-border/60 border-t pt-3 text-[13px] text-kallo-text-muted leading-relaxed">
          {t('manageUnavailable')}
        </p>
      )}
    </div>
  );
}
