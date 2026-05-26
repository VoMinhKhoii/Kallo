'use client';

import { AlertCircle } from 'lucide-react';
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
      className="flex gap-3 rounded-2xl border border-amber-200/70 bg-amber-50/80 p-3 sm:p-4"
    >
      <AlertCircle
        className="mt-0.5 size-4 shrink-0 text-amber-600"
        aria-hidden="true"
      />
      <div className="min-w-0">
        <p className="font-medium text-amber-900 text-sm">{t('title')}</p>
        <p className="mt-0.5 text-[13px] text-amber-800/90">
          {t('body', { calories, target })}
        </p>
      </div>
    </div>
  );
}
