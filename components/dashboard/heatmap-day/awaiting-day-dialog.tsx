'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import type { RefObject } from 'react';
import { ConfirmDialog } from '@/components/shared/confirm-dialog/confirm-dialog';
import { ResponsiveModal } from '@/components/shared/responsive-modal';
import { Button } from '@/components/ui/button';
import { useMarkDayComplete } from '@/hooks/meals/mutations/use-mark-day-complete';
import { useRouter } from '@/i18n/navigation';
import { dayKeyToUtcDate } from '@/lib/core/date/day-key';
import { AwaitingDayMeals } from './awaiting-day-meals';
import { AwaitingDayTotal } from './awaiting-day-total';

interface AwaitingDayDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The heatmap cell it opened from, where focus returns on close. */
  returnFocusRef: RefObject<HTMLElement | null>;
  userId: string;
  /** Local day key of the awaiting cell. */
  date: string;
  /** The day's logged kcal — what the trends will count it at. */
  calories: number;
  /** Today is still accruing meals, so it can be reviewed but not confirmed. */
  isToday: boolean;
}

/**
 * An awaiting (under-logged) heatmap day, opened from its cell: the day's
 * meals for the user to recall, then the two honest answers — something is
 * missing (open that day's logging to add it) or that's everything (the same
 * one-way mark, behind the same "are you sure?" the logging feed asks).
 */
export function AwaitingDayDialog({
  open,
  onOpenChange,
  returnFocusRef,
  userId,
  date,
  calories,
  isToday,
}: AwaitingDayDialogProps) {
  const t = useTranslations('dashboard.adherenceHeatmap.dayDialog');
  const tNotice = useTranslations('logging.feedArea.partialDayNotice');
  const locale = useLocale();
  const queryClient = useQueryClient();
  const router = useRouter();
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
      returnFocusRef={returnFocusRef}
      dismissible={!markDay.isPending}
      title={title}
      dialogClassName="sm:max-w-md"
      bodyClassName="px-4 md:px-[22px]"
    >
      <p className="pt-2 text-[13px] text-kallo-text-muted leading-relaxed">
        {isToday
          ? t('todayNote')
          : tNotice('confirmBody', { calories: roundedCalories })}
      </p>

      <AwaitingDayMeals date={date} />

      <div className="sticky bottom-0 mt-auto flex flex-col gap-3 border-kallo-border/50 border-t bg-card py-4">
        <AwaitingDayTotal date={date} />
        <div className="flex justify-end gap-2">
          <Button
            variant="ghost"
            className="rounded-xl font-sans-display hover:bg-kallo-hover hover:text-kallo-text dark:hover:bg-kallo-hover"
            disabled={markDay.isPending}
            onClick={() => {
              onOpenChange(false);
              router.push(`/logging?date=${date}`);
            }}
          >
            {t('addMissed')}
          </Button>
          {isToday ? null : (
            // The button is the ask's own trigger, so cancelling it puts
            // focus back here rather than on the page.
            <ConfirmDialog
              trigger={
                <Button
                  className="rounded-xl font-sans-display"
                  disabled={markDay.isPending}
                >
                  {tNotice('confirmAccept')}
                </Button>
              }
              title={tNotice('confirmTitle')}
              description={tNotice('confirmBody', {
                calories: roundedCalories,
              })}
              confirmLabel={tNotice('confirmAccept')}
              cancelLabel={tNotice('confirmCancel')}
              onConfirm={confirm}
            />
          )}
        </div>
      </div>
    </ResponsiveModal>
  );
}
