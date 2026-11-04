'use client';

import { Check } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { MarkDayCompleteButton } from '@/components/logging/feed/partial-day/mark-day-complete-button';

interface TodayCloseProps {
  /** Today's logged calories — what the day will be counted at. */
  calories: number;
  /** Already closed: say so instead of offering it again. */
  closed: boolean;
  onClose: () => void;
  isClosing: boolean;
}

/**
 * "I've eaten enough" on Today: the end of the day, said by the person who
 * ate it. Closing stops today's meal reminders and lets the progress view
 * count the day at its real calories. The same quiet outlined capsule as the
 * past-day notice — the composer stays the screen's one primary action — and,
 * once closed, a muted line in its place, since the write is one-way.
 */
export function TodayClose({
  calories,
  closed,
  onClose,
  isClosing,
}: TodayCloseProps) {
  const t = useTranslations('logging.feedArea.todayClose');

  if (closed) {
    return (
      <p
        role="status"
        className="inline-flex min-h-8 items-center gap-2 font-sans-display text-kallo-text-muted text-sm"
      >
        <Check className="size-icon-inline" aria-hidden="true" />
        {t('closed')}
      </p>
    );
  }
  return (
    <MarkDayCompleteButton
      calories={calories}
      copy="todayClose"
      isPending={isClosing}
      onConfirm={onClose}
    />
  );
}
