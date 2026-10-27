'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { ResponsiveModal } from '@/components/shared/responsive-modal';
import { Button } from '@/components/ui/button';
import { useMarkDayComplete } from '@/hooks/meals/mutations/use-mark-day-complete';
import { dayKeyToUtcDate } from '@/lib/core/date/day-key';
import { AwaitingDayMeals } from './awaiting-day-meals';

interface AwaitingDayDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  /** Local day key of the awaiting cell. */
  date: string;
  /** The day's logged kcal — what the trends will count it at. */
  calories: number;
  calorieTarget: number;
  /** Today is still accruing meals, so it can be reviewed but not confirmed. */
  isToday: boolean;
}

/**
 * An awaiting (under-logged) heatmap day, opened from its cell: the day's
 * meals for the user to recall, and the same one-way "That's everything I ate"
 * the logging feed offers. The dialog itself is the confirmation step — the
 * user has the meals in front of them, and the footer carries the
 * can't-be-undone line the feed's second dialog would.
 */
export function AwaitingDayDialog({
  open,
  onOpenChange,
  userId,
  date,
  calories,
  calorieTarget,
  isToday,
}: AwaitingDayDialogProps) {
  const t = useTranslations('dashboard.adherenceHeatmap.dayDialog');
  const tNotice = useTranslations('logging.feedArea.partialDayNotice');
  const locale = useLocale();
  const queryClient = useQueryClient();
  const markDay = useMarkDayComplete(userId, date);
  const roundedCalories = Math.round(calories);

  const title = dayKeyToUtcDate(date).toLocaleDateString(locale, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  });

  const confirm = () =>
    markDay.mutate(undefined, {
      onSuccess: () => {
        // The hook only marks the dashboard stale; the heatmap is on screen
        // here, so refetch it now or the cell keeps its ring.
        void queryClient.invalidateQueries({
          queryKey: ['dashboard', 'heatmapData'],
        });
        onOpenChange(false);
      },
    });

  return (
    <ResponsiveModal
      open={open}
      onOpenChange={onOpenChange}
      dismissible={!markDay.isPending}
      title={title}
      dialogClassName="sm:max-w-md"
      bodyClassName="px-4 md:px-[22px]"
    >
      <p className="pt-2 text-[13px] text-kallo-text-muted leading-relaxed">
        {tNotice('body', { calories: roundedCalories, target: calorieTarget })}
      </p>

      <AwaitingDayMeals date={date} />

      <div className="sticky bottom-0 mt-auto flex flex-col gap-3 border-kallo-border/50 border-t bg-card py-4">
        <p className="text-[13px] text-kallo-text-muted leading-relaxed">
          {isToday
            ? t('todayNote')
            : tNotice('confirmBody', { calories: roundedCalories })}
        </p>
        {isToday ? null : (
          <div className="flex justify-end gap-2">
            <Button
              variant="ghost"
              className="rounded-xl font-sans-display hover:bg-kallo-hover hover:text-kallo-text dark:hover:bg-kallo-hover"
              disabled={markDay.isPending}
              onClick={() => onOpenChange(false)}
            >
              {tNotice('confirmCancel')}
            </Button>
            <Button
              className="rounded-xl font-sans-display"
              disabled={markDay.isPending}
              onClick={confirm}
            >
              {tNotice('confirmAccept')}
            </Button>
          </div>
        )}
      </div>
    </ResponsiveModal>
  );
}
