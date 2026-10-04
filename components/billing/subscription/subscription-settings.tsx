'use client';

import { Crown, Loader2 } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useEntitlements } from '@/hooks/billing/use-entitlements';
import { Link } from '@/i18n/navigation';
import { pricingHref } from '@/lib/domain/billing/pricing/pricing-href';
import { ExpiryReminderBanner } from './expiry-reminder-banner';
import { PremiumState } from './premium-state';

function daysUntil(iso: string | null): number {
  if (!iso) return Number.POSITIVE_INFINITY;
  const ms = new Date(iso).getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / (24 * 60 * 60 * 1000)));
}

/**
 * Subscription section for the settings page. Reflects the user's current
 * entitlement state and offers the right next action per source:
 *  - free       → upgrade link to /pricing (the purchase page)
 *  - premium/web→ manage via the Paddle customer portal
 *  - premium/app→ "manage in App Store / Google Play" deep link
 *  - lifetime   → no expiry, no management
 */
export function SubscriptionSettings({
  userId,
  locale,
}: {
  userId: string;
  locale: string;
}) {
  const t = useTranslations('billing.settings');
  const { data, isPending, isError } = useEntitlements(userId);
  // The full, locale-prefixed path, so /pricing can link back here.
  const pathname = usePathname();

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
      {showExpiryBanner && (
        <ExpiryReminderBanner
          daysRemaining={expiryDays}
          // The displayed end date belongs to whichever grant owns access; a
          // promo-owned one is free Premium even beside a cancelled
          // subscription that ends sooner.
          complimentary={data.source === 'promo'}
        />
      )}

      <div className="rounded-2xl border border-kallo-border/70 bg-white px-4 py-4">
        {data.tier === 'premium' ? (
          <PremiumState
            data={data}
            locale={locale}
            t={t}
            upgradeHref={
              data.complimentary && data.purchasesEnabled
                ? pricingHref(pathname)
                : null
            }
          />
        ) : (
          <FreeState upgradeHref={pricingHref(pathname)} t={t} />
        )}
      </div>
    </div>
  );
}

function FreeState({
  upgradeHref,
  t,
}: {
  upgradeHref: string;
  t: ReturnType<typeof useTranslations>;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="flex items-center gap-1.5 text-[15px] text-kallo-text">
          <Crown aria-hidden="true" className="h-4 w-4 text-kallo-accent" />
          {t('freePlan')}
        </p>
        <p className="mt-0.5 text-[13px] text-kallo-text-muted">
          {t('freeDescription')}
        </p>
      </div>
      <Link
        href={upgradeHref}
        className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-xl bg-kallo-ink px-4 py-2 font-medium text-[14px] text-kallo-surface transition-colors hover:bg-kallo-ink-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kallo-accent"
      >
        {t('upgradeCta')}
      </Link>
    </div>
  );
}
