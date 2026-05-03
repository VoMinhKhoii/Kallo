'use client';

import { AlertCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { TimelineDateButton } from './timeline-date-button';
import {
  formatDayLabel,
  getSelectedMonthKey,
  getSelectedWeekKey,
  groupByMonth,
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
  const td = useTranslations('dashboard');
  const locale = useLocale();

  const months = useMemo(() => groupByMonth(allDates), [allDates]);

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

  const hasSavedMeals = dates.length > 0;

  // Loading state
  if (isPending) {
    return (
      <nav
        className="hidden h-full w-[232px] shrink-0 flex-col overflow-hidden rounded-2xl border border-nham-border/60 bg-white/70 shadow-nham-text/[0.03] shadow-sm md:flex"
        aria-label={t('navigationLabel')}
      >
        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-3">
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
      className="hidden h-full w-[232px] shrink-0 flex-col overflow-hidden rounded-2xl border border-nham-border/60 bg-white/70 shadow-nham-text/[0.03] shadow-sm md:flex"
      aria-label={t('navigationLabel')}
    >
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-3">
        {/* Error state */}
        {isError && (
          <div className="flex flex-col gap-2 rounded-lg border border-red-200/60 bg-red-50/80 p-3">
            <div className="flex items-center gap-2 text-red-900 text-sm">
              <AlertCircle className="h-4 w-4" aria-hidden="true" />
              <span className="flex-1 font-medium">
                {t('failedToLoadDates')}
              </span>
            </div>
            <button
              type="button"
              onClick={onRetry}
              className="rounded-lg bg-red-100 px-3 py-2 font-medium text-red-900 text-sm transition-[background-color,color] hover:bg-red-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600 focus-visible:ring-offset-2"
            >
              {t('retryDates')}
            </button>
          </div>
        )}

        {/* Empty state */}
        {!hasSavedMeals && (
          <div className="rounded-lg border border-nham-border/40 bg-nham-hover/30 p-3 text-center text-nham-text-muted text-sm">
            {t('noPreviousMeals')}
          </div>
        )}

        {/* Timeline */}
        {months.map((month, monthIndex) => {
          const isMonthExpanded = expandedMonths.has(month.key);

          return (
            <div key={month.key} className="flex w-full flex-col gap-3">
              <div className="flex w-full flex-col gap-2">
                <button
                  type="button"
                  onClick={() => toggleMonth(month.key)}
                  aria-expanded={isMonthExpanded}
                  aria-controls={`month-${month.key}`}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-nham-text-muted transition-[background-color,color] hover:bg-nham-hover/40 hover:text-nham-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nham-accent focus-visible:ring-offset-2"
                >
                  <span className="flex-1 text-left font-medium font-sans-display text-[10px] uppercase tracking-[0.04em]">
                    {month.month}/{month.year}
                  </span>
                  {isMonthExpanded ? (
                    <ChevronUp className="h-4 w-4" aria-hidden="true" />
                  ) : (
                    <ChevronDown className="h-4 w-4" aria-hidden="true" />
                  )}
                </button>

                {isMonthExpanded && (
                  <div
                    id={`month-${month.key}`}
                    className="flex w-full flex-col gap-2"
                  >
                    {month.weeks.map((week) => {
                      const isWeekExpanded = expandedWeeks.has(week.key);
                      const hasSelectedDay = week.days.includes(selectedDate);

                      return (
                        <div key={week.key} className="w-full">
                          <button
                            type="button"
                            onClick={() => toggleWeek(week.key)}
                            aria-expanded={isWeekExpanded}
                            aria-controls={`week-${week.key}`}
                            className={cn(
                              'flex w-full items-center gap-3 rounded-lg px-3 py-2 transition-[background-color,color] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nham-accent focus-visible:ring-offset-2',
                              hasSelectedDay
                                ? 'bg-nham-accent/35 text-nham-text'
                                : 'text-nham-text-muted hover:bg-nham-hover/40 hover:text-nham-text'
                            )}
                          >
                            <span className="flex-1 text-left font-medium font-sans-display text-sm leading-5 tracking-tight">
                              {t('week', { number: week.weekNumber })}
                            </span>
                            {isWeekExpanded ? (
                              <ChevronUp
                                className="h-4 w-4"
                                aria-hidden="true"
                              />
                            ) : (
                              <ChevronDown
                                className="h-4 w-4"
                                aria-hidden="true"
                              />
                            )}
                          </button>

                          {isWeekExpanded && (
                            <div
                              id={`week-${week.key}`}
                              className="mt-2 flex w-full flex-col gap-1.5"
                            >
                              {week.days.map((date) => {
                                const isActive = date === selectedDate;
                                const isToday = date === today;
                                const hasMeal = dates.includes(date);
                                const label = isToday
                                  ? td('today')
                                  : formatDayLabel(date, locale);

                                return (
                                  <TimelineDateButton
                                    key={date}
                                    date={date}
                                    label={label}
                                    isActive={isActive}
                                    isToday={isToday}
                                    hasMeal={hasMeal}
                                    variant="desktop"
                                    onSelectDate={onSelectDate}
                                  />
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {monthIndex < months.length - 1 && (
                <div className="h-px w-full rounded-sm bg-nham-border/30" />
              )}
            </div>
          );
        })}
      </div>
    </nav>
  );
}
