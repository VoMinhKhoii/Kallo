'use client';

import { Crown, ExternalLink } from 'lucide-react';
import type { useTranslations } from 'next-intl';
import { SECONDARY_BUTTON } from '@/components/settings/chrome/controls';
import type { useEntitlements } from '@/hooks/billing/use-entitlements';
import { BillingSections } from './billing-sections';
import { PlanFeatures } from './plan-features';
import { PlanSummary } from './plan-summary';
import { UpgradeLink } from './upgrade-link';

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
  // A paid, renewable plan gets Claude's outline (Payment, Invoices,
  // Cancellation) under its features; those rows carry the store link, so
  // the head has no Manage button. A lifetime plan with a stray subscription
  // keeps Manage in its head, beside the warning to cancel it.
  const withSections = manageUrl !== null && !data.isLifetime;

  const manage =
    manageUrl && !withSections ? (
      <a
        href={manageUrl}
        target="_blank"
        rel="noopener noreferrer"
        className={SECONDARY_BUTTON}
      >
        <ExternalLink aria-hidden="true" className="h-3.5 w-3.5" />
        {data.managementStore === 'app_store'
          ? t('manageAppStore')
          : data.managementStore === 'play_store'
            ? t('managePlayStore')
            : t('manageWeb')}
      </a>
    ) : null;

  // The plan's actions sit on its right, the way Upgrade does on Free's.
  // Complimentary Premium can carry both: Upgrade, and Manage for a paid
  // subscription still running beside it.
  const action =
    upgradeHref || manage ? (
      <div className="flex shrink-0 gap-2">
        {upgradeHref && <UpgradeLink href={upgradeHref} t={t} />}
        {manage}
      </div>
    ) : null;
  return (
    <div>
      <PlanSummary
        icon={Crown}
        name={data.isLifetime ? t('lifetimePlan') : t('premiumPlan')}
        subtitle={
          data.isLifetime
            ? t('lifetimeDescription')
            : data.willRenew && renewalDate
              ? t('renewsOn', { date: renewalDate })
              : renewalDate
                ? t('expiresOn', { date: renewalDate })
                : t('premiumDescription')
        }
        action={action}
      >
        {data.isLifetime && data.hasActiveSubscription && (
          <p className="mt-3 text-[13px] text-kallo-danger">
            {t('lifetimeSubscriptionWarning')}
          </p>
        )}
        {data.hasActiveSubscription && !manageUrl && (
          <p className="mt-3 text-[13px] text-kallo-text-muted leading-relaxed">
            {t('manageUnavailable')}
          </p>
        )}
      </PlanSummary>
      <PlanFeatures plan={data.isLifetime ? 'lifetime' : 'premium'} />
      {withSections && (
        <BillingSections
          manageUrl={manageUrl}
          store={data.managementStore}
          willRenew={data.willRenew}
          renewalDate={renewalDate}
          t={t}
        />
      )}
    </div>
  );
}
