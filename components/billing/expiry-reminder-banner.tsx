'use client';

import { CalendarClock } from 'lucide-react';
import { useTranslations } from 'next-intl';

/**
 * Shown inside subscription settings when a paid plan is set to lapse
 * (willRenew=false) within the next few days. Calm terracotta concern
 * register — never the cold shadcn `destructive`.
 */
export function ExpiryReminderBanner({
  daysRemaining,
}: {
  daysRemaining: number;
}) {
  const t = useTranslations('billing.settings');

  return (
    <div className="flex items-start gap-3 rounded-2xl border border-nham-danger/30 bg-nham-danger/5 px-4 py-3.5">
      <CalendarClock
        aria-hidden="true"
        className="mt-0.5 h-4 w-4 shrink-0 text-nham-danger"
      />
      <div className="min-w-0">
        <p className="text-[14px] text-nham-text">{t('expiryTitle')}</p>
        <p className="mt-0.5 text-[13px] text-nham-text-soft">
          {t('expiryBody', { days: daysRemaining })}
        </p>
      </div>
    </div>
  );
}
