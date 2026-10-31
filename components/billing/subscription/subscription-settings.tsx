'use client';

import { Loader2, Sprout } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useEntitlements } from '@/hooks/billing/use-entitlements';
import { pricingHref } from '@/lib/domain/billing/pricing/pricing-href';
import { ExpiryReminderBanner } from './expiry-reminder-banner';
import { PlanFeatures } from './plan-features';
import { PlanSummary } from './plan-summary';
import { PremiumState } from './premium-state';
import { UpgradeLink } from './upgrade-link';

function daysUntil(iso: string | null): number {
  if (!iso) return Number.POSITIVE_INFINITY;
  const ms = new Date(iso).getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / (24 * 60 * 60 * 1000)));
}

/**
 * The settings dialog's Subscriptions page, laid out like Claude's billing
 * page: the plan with its one action, then what the plan includes. Reflects
 * the user's current entitlement state and offers the right next action:
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
  const tPremium = useTranslations('billing.premium');
  const tLanding = useTranslations('landing.pricing');
  const { data, isPending, isError } = useEntitlements(userId);
  // The full, locale-prefixed path, so /pricing can link back here.
  const pathname = usePathname();

  if (isPending) {
    return (
      <p className="flex items-center gap-2 text-[14px] text-kallo-text-muted">
        <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
        {t('loading')}
      </p>
    );
  }

  if (isError || !data) {
    return (
      <p className="text-[14px] text-kallo-text-muted">{t('loadError')}</p>
    );
  }

  // Nothing to buy yet: say so in place of the Upgrade button.
  if (!data.purchasesEnabled && data.tier !== 'premium') {
    return (
      <div className="font-sans-display">
        <PlanSummary
          icon={Sprout}
          name={t('freePlan')}
          subtitle={tPremium('purchasesUnavailable')}
        />
        <PlanFeatures plan="free" />
      </div>
    );
  }

  const expiryDays = daysUntil(data.expiresAt);
  const showExpiryBanner =
    data.tier === 'premium' &&
    !data.isLifetime &&
    !data.willRenew &&
    expiryDays <= 5;

  return (
    <div className="flex flex-col gap-6 font-sans-display">
      {showExpiryBanner && (
        <ExpiryReminderBanner
          daysRemaining={expiryDays}
          // The displayed end date belongs to whichever grant owns access; a
          // promo-owned one is free Premium even beside a cancelled
          // subscription that ends sooner.
          complimentary={data.source === 'promo'}
        />
      )}

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
        <div>
          <PlanSummary
            icon={Sprout}
            name={t('freePlan')}
            subtitle={tLanding('plans.free.tagline')}
            action={<UpgradeLink href={pricingHref(pathname)} t={t} />}
          />
          <PlanFeatures plan="free" />
        </div>
      )}
    </div>
  );
}
