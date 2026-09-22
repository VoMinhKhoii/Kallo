'use client';

import { AlertCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { TimelineDayRow } from './timeline-day-row';
import { buildTimelineTree } from './timeline-tree';
import {
  formatTimelineDayLabel,
  formatWeekDateRange,
  getSelectedMonthKey,
  getSelectedWeekKey,
  getWeekDateRange,
  sortTimelineDaysAscending,
} from './timeline-utils';

interface TimelineSidebarProps {
  /**
   * Every day that holds a log, mapped to its calories (null when nothing is
   * countable). Days outside it still render — they are what you click to
   * backfill — they just read quieter and carry no number. Membership and the
   * total come from this one map so the two can never disagree.
   */
  dailyKcal: Map<string, number | null>;
  today: string;
  selectedDate: string;
  isPending: boolean;
  isError: boolean;
  onRetry: () => void;
  onSelectDate: (date: string) => void;
}

export function TimelineSidebar({
  dailyKcal,
  today,
  selectedDate,
  isPending,
  isError,
  onRetry,
  onSelectDate,
}: TimelineSidebarProps) {
  const t = useTranslations('logging.timelineSidebar');
  const locale = useLocale();

  const months = useMemo(
    () =>
      buildTimelineTree({
        dates: Array.from(dailyKcal.keys()),
        today,
        selectedDate,
      }),
    [dailyKcal, selectedDate, today]
  );

  const selectedMonth = useMemo(
    () => getSelectedMonthKey(selectedDate),
    [selectedDate]
  );

  const selectedWeekKey = useMemo(
    () => getSelectedWeekKey(selectedDate),
    [selectedDate]
  );

  const [expandedMonths, setExpandedMonths] = useState<Set<string>>(
    () => new Set([selectedMonth])
  );
  const [expandedWeeks, setExpandedWeeks] = useState<Set<string>>(
    () => new Set([selectedWeekKey])
  );

  // Auto-expand the month/week containing the newly selected date
  useEffect(() => {
    setExpandedMonths((prev) => new Set(prev).add(selectedMonth));
    setExpandedWeeks((prev) => new Set(prev).add(selectedWeekKey));
  }, [selectedMonth, selectedWeekKey]);

  const toggleMonth = useCallback((monthKey: string) => {
    setExpandedMonths((prev) => {
      const next = new Set(prev);
      if (next.has(monthKey)) next.delete(monthKey);
      else next.add(monthKey);
      return next;
    });
  }, []);

  const toggleWeek = useCallback((weekKey: string) => {
    setExpandedWeeks((prev) => {
      const next = new Set(prev);
      if (next.has(weekKey)) next.delete(weekKey);
      else next.add(weekKey);
      return next;
    });
  }, []);

  const hasSavedMeals = dailyKcal.size > 0;

  // Loading state
  if (isPending) {
    return (
      <nav
        className="hidden h-full w-72 shrink-0 flex-col overflow-hidden border-border/40 border-r py-3 pr-3 lg:flex"
        aria-label={t('navigationLabel')}
      >
        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto overscroll-contain">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-12 rounded-lg bg-kallo-track motion-safe:animate-pulse"
              aria-busy="true"
            />
          ))}
        </div>
      </nav>
    );
  }

  return (
    <nav
      className="hidden h-full w-72 shrink-0 flex-col overflow-hidden border-border/40 border-r py-3 pr-3 lg:flex"
      aria-label={t('navigationLabel')}
    >
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto overflow-x-hidden overscroll-contain">
        {/* Error state */}
        {isError && (
          <div className="ml-3 flex flex-col gap-2 rounded-lg border border-kallo-danger/30 bg-kallo-danger/10 p-3">
            <div className="flex items-center gap-2 text-kallo-danger text-sm">
              <AlertCircle className="h-4 w-4" aria-hidden="true" />
              <span className="flex-1 font-medium">
                {t('failedToLoadDates')}
              </span>
            </div>
            <button
              type="button"
              onClick={onRetry}
              className="rounded-lg bg-kallo-danger/15 px-3 py-2 font-medium text-kallo-danger text-sm transition-[background-color,color] hover:bg-kallo-danger/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kallo-danger focus-visible:ring-offset-2"
            >
              {t('retryDates')}
            </button>
          </div>
        )}

        {/* Empty state */}
        {!hasSavedMeals && (
          <div className="ml-3 rounded-lg border border-kallo-border/40 bg-kallo-hover/30 p-3 text-center text-kallo-text-muted text-sm">
            {t('noPreviousMeals')}
          </div>
        )}

        {/* Timeline */}
        {months.map((month) => {
          const isMonthExpanded = expandedMonths.has(month.key);

          return (
            <div key={month.key} className="flex w-full flex-col gap-2">
              {/* Month header */}
              <button
                type="button"
                onClick={() => toggleMonth(month.key)}
                aria-expanded={isMonthExpanded}
                aria-controls={`month-${month.key}`}
                className="group ml-3 flex w-[calc(100%-0.75rem)] min-w-0 items-center gap-2 text-kallo-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kallo-accent focus-visible:ring-offset-2"
              >
                <span className="min-w-0 flex-1 truncate text-left font-medium font-sans-display text-[10px] uppercase tracking-[0.04em] group-hover:font-bold">
                  {month.month}/{month.year}
                </span>
                {isMonthExpanded ? (
                  <ChevronUp className="h-3.5 w-3.5" aria-hidden="true" />
                ) : (
                  <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
                )}
              </button>

              {/* Month content */}
              {isMonthExpanded && (
                <div
                  id={`month-${month.key}`}
                  className="flex w-full flex-col gap-2"
                >
                  {/* Month separator */}
                  <div className="ml-3 h-0.5 rounded-sm bg-neutral-100" />

                  {/* Weeks */}
                  {month.weeks.map((week) => {
                    const isWeekExpanded = expandedWeeks.has(week.key);
                    const weekRange = getWeekDateRange({
                      year: month.year,
                      month: month.month,
                      weekNumber: week.weekNumber,
                    });
                    const weekRangeLabel = formatWeekDateRange(
                      weekRange,
                      locale
                    );
                    const sortedDays = sortTimelineDaysAscending(week.days);

                    return (
                      <div key={week.key} className="w-full min-w-0">
                        {/* Week button */}
                        <button
                          type="button"
                          onClick={() => toggleWeek(week.key)}
                          aria-expanded={isWeekExpanded}
                          aria-controls={`week-${week.key}`}
                          className="group ml-3 flex w-[calc(100%-0.75rem)] min-w-0 items-center gap-2 rounded-md px-1 py-1.5 text-kallo-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kallo-accent focus-visible:ring-offset-2"
                        >
                          <span className="flex min-w-0 flex-1 items-baseline gap-2 text-left font-sans-display tracking-tight">
                            <span className="shrink-0 font-semibold text-[13px] group-hover:font-bold">
                              {t('week', { number: week.weekNumber })}
                            </span>
                            <span className="min-w-0 truncate font-medium text-[11px] text-kallo-text-muted/75">
                              {weekRangeLabel}
                            </span>
                          </span>
                          {isWeekExpanded ? (
                            <ChevronUp
                              className="h-3.5 w-3.5 shrink-0"
                              aria-hidden="true"
                            />
                          ) : (
                            <ChevronDown
                              className="h-3.5 w-3.5 shrink-0"
                              aria-hidden="true"
                            />
                          )}
                        </button>

                        {/* Day tree */}
                        {isWeekExpanded && (
                          <div
                            id={`week-${week.key}`}
                            className="relative mt-1 ml-3 min-w-0 pl-8"
                          >
                            {/* Days list */}
                            <ul className="flex min-w-0 flex-1 flex-col gap-1.5">
                              {sortedDays.map((date, index) => (
                                <TimelineDayRow
                                  key={date}
                                  date={date}
                                  label={formatTimelineDayLabel(date, locale)}
                                  isFirst={index === 0}
                                  isLast={index === sortedDays.length - 1}
                                  isActive={date === selectedDate}
                                  isToday={date === today}
                                  todayLabel={t('todayLabel')}
                                  hasMeal={dailyKcal.has(date)}
                                  kcal={dailyKcal.get(date) ?? null}
                                  onSelectDate={onSelectDate}
                                />
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </nav>
  );
}
