'use client';

import { useTranslations } from 'next-intl';

interface PartialDayNoticeProps {
  calories: number;
  target: number;
}

export function PartialDayNotice({ calories, target }: PartialDayNoticeProps) {
  const t = useTranslations('logging.feedArea.partialDayNotice');

  return (
    <div
      role="status"
      className="rounded-2xl border border-nham-border/60 bg-white p-3 sm:p-4"
    >
      <p className="font-serif text-base text-nham-danger italic">
        {t('title')}
      </p>
      <p className="mt-1 font-sans-display text-[13px] text-nham-text-muted">
        {t('body', { calories, target })}
      </p>
    </div>
  );
}
