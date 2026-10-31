'use client';

import { useTranslations } from 'next-intl';
import { SubscriptionSettings } from '@/components/billing/subscription/subscription-settings';
import { useEntitlements } from '@/hooks/billing/use-entitlements';

/**
 * The Plan page. SubscriptionSettings draws nothing for a free user while
 * purchases are off, which would leave this page empty, so it says why.
 */
export function PlanRows({
  userId,
  locale,
}: {
  userId: string;
  locale: string;
}) {
  const t = useTranslations('billing');
  const { data } = useEntitlements(userId);
  const nothingToBuy =
    data && !data.purchasesEnabled && data.tier !== 'premium';

  if (nothingToBuy) {
    return (
      <div className="rounded-2xl border border-kallo-border bg-card p-card-sm">
        <p className="text-[15px] text-kallo-text">{t('settings.freePlan')}</p>
        <p className="mt-0.5 text-[13px] text-kallo-text-muted">
          {t('premium.purchasesUnavailable')}
        </p>
      </div>
    );
  }

  return <SubscriptionSettings userId={userId} locale={locale} />;
}
