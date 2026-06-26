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
      className="rounded-2xl border border-nham-border/60 bg-nham-surface p-3 sm:p-4"
    >
      <p
        className="text-base text-nham-danger italic"
        style={{ fontFamily: 'Lora, serif' }}
      >
        {t('title')}
      </p>
      <p
        className="mt-1 text-[13px] text-nham-text-muted"
        style={{ fontFamily: 'DM Sans, sans-serif' }}
      >
        {t('body', { calories, target })}
      </p>
    </div>
  );
}
