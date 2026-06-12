'use client';

import { AlertCircle } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useCallback, useMemo } from 'react';
import { TimelineDateButton } from './timeline-date-button';
import {
  adjacentDate,
  formatMonthDivider,
  formatTimelineDayLabel,
  groupDaysByMonthFlat,
} from './timeline-utils';

interface TimelineSidebarProps {
  dates: string[];
  allDates: string[];
  today: string;
  selectedDate: string;
  isPending: boolean;
  isError: boolean;
  onRetry: () => void;
  onSelectDate: (date: string) => void;
}

export function TimelineSidebar({
  dates,
  allDates,
  today,
  selectedDate,
  isPending,
  isError,
  onRetry,
  onSelectDate,
}: TimelineSidebarProps) {
  const t = useTranslations('logging.timelineSidebar');
  const locale = useLocale();

  // Flat, reverse-chronological day list grouped under sticky month dividers —
  // the single-level replacement for the month→week→day accordion tree.
  const monthGroups = useMemo(() => groupDaysByMonthFlat(allDates), [allDates]);
  // The navigable order for keyboard ←/→ (newest-first, mirrors the list).
  const orderedDescending = useMemo(
    () => [...allDates].sort((a, b) => b.localeCompare(a)),
    [allDates]
  );
  const mealDates = useMemo(() => new Set(dates), [dates]);

  // ArrowLeft steps to an older day (visually down the list); ArrowRight to a
  // newer day. Scoped to the nav so it never hijacks typing in the composer.
  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLElement>) => {
      const direction =
        event.key === 'ArrowLeft' ? -1 : event.key === 'ArrowRight' ? 1 : 0;
      if (direction === 0) return;
      const next = adjacentDate(
        orderedDescending,
        selectedDate,
        direction as 1 | -1
      );
      if (next) {
        event.preventDefault();
        onSelectDate(next);
      }
    },
    [orderedDescending, selectedDate, onSelectDate]
  );

  const hasSavedMeals = dates.length > 0;

  if (isPending) {
    return (
      <nav
        className="hidden h-full w-[252px] shrink-0 flex-col overflow-hidden border-border/40 border-r py-3 pr-3 md:flex"
        aria-label={t('navigationLabel')}
      >
        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-12 animate-pulse rounded-lg bg-nham-hover/40"
              aria-busy="true"
            />
          ))}
        </div>
      </nav>
    );
  }

  return (
    <nav
      className="hidden h-full w-[252px] shrink-0 flex-col overflow-hidden border-border/40 border-r py-3 pr-3 focus:outline-none md:flex"
      aria-label={t('navigationLabel')}
      // biome-ignore lint/a11y/noNoninteractiveTabindex: the nav is a roving keyboard target for ArrowLeft/Right day navigation.
      tabIndex={0}
      onKeyDown={handleKeyDown}
    >
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden">
        {/* Error state */}
        {isError && (
          <div className="mb-4 ml-3 flex flex-col gap-2 rounded-lg border border-nham-danger/30 bg-nham-danger/10 p-3">
            <div className="flex items-center gap-2 text-nham-danger text-sm">
              <AlertCircle className="h-4 w-4" aria-hidden="true" />
              <span className="flex-1 font-medium">
                {t('failedToLoadDates')}
              </span>
            </div>
            <button
              type="button"
              onClick={onRetry}
              className="rounded-lg bg-nham-danger/15 px-3 py-2 font-medium text-nham-danger text-sm transition-[background-color,color] hover:bg-nham-danger/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nham-danger focus-visible:ring-offset-2"
            >
              {t('retryDates')}
            </button>
          </div>
        )}

        {/* Empty state */}
        {!hasSavedMeals && (
          <div className="ml-3 rounded-lg border border-nham-border/40 bg-nham-hover/30 p-3 text-center text-nham-text-muted text-sm">
            {t('noPreviousMeals')}
          </div>
        )}

        {/* Flat day list, month dividers sticky at the top of their section */}
        {monthGroups.map((group) => (
          <section key={group.key} className="flex flex-col">
            <h2 className="sticky top-0 z-10 mb-1.5 ml-3 bg-nham-surface py-1.5 font-medium font-sans-display text-[10px] text-muted-foreground uppercase tracking-[0.08em]">
              {formatMonthDivider(group, locale)}
            </h2>
            <ul className="mb-3 flex flex-col gap-1">
              {group.days.map((date) => (
                <li key={date} className="flex w-full min-w-0">
                  <TimelineDateButton
                    date={date}
                    label={formatTimelineDayLabel(date, locale)}
                    isActive={date === selectedDate}
                    isToday={date === today}
                    todayLabel={t('todayLabel')}
                    hasMeal={mealDates.has(date)}
                    variant="desktop"
                    onSelectDate={onSelectDate}
                  />
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </nav>
  );
}
