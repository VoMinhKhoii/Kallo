'use client';

import { useTranslations } from 'next-intl';
import { MarkDayCompleteButton } from '@/components/logging/feed/partial-day/mark-day-complete-button';

interface PartialDayNoticeProps {
  calories: number;
  target: number;
  /**
   * Attest that this day is fully logged. One-way, so the button confirms
   * first; this component only reports the decision.
   */
  onMarkComplete: () => void;
  isMarkingComplete: boolean;
}

export function PartialDayNotice({
  calories,
  target,
  onMarkComplete,
  isMarkingComplete,
}: PartialDayNoticeProps) {
  const t = useTranslations('logging.feedArea.partialDayNotice');

  return (
    <div
      role="status"
      className="rounded-2xl border border-kallo-border/60 bg-white p-3 sm:p-4"
    >
      <p className="font-sans-display text-base text-kallo-danger italic">
        {t('title')}
      </p>
      <p className="mt-1 font-sans-display text-[13px] text-kallo-text-muted">
        {t('body', { calories, target })}
      </p>
      <MarkDayCompleteButton
        calories={calories}
        isPending={isMarkingComplete}
        onConfirm={onMarkComplete}
      />
    </div>
  );
}
