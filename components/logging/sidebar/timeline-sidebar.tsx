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
        className="hidden h-full w-[212px] shrink-0 flex-col border-border/40 border-r py-3 pr-3 md:flex"
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
      className="hidden h-full w-[212px] shrink-0 flex-col border-border/40 border-r py-3 pr-3 md:flex"
      aria-label={t('navigationLabel')}
    >
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto">
        {/* Error state */}
        {isError && (
          <div className="ml-3 flex flex-col gap-2 rounded-lg border border-red-200/60 bg-red-50/80 p-3">
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
          <div className="ml-3 rounded-lg border border-nham-border/40 bg-nham-hover/30 p-3 text-center text-nham-text-muted text-sm">
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
                className="ml-3 flex w-full items-center gap-2 text-muted-foreground transition-colors hover:text-nham-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nham-accent focus-visible:ring-offset-2"
              >
                <span className="flex-1 text-left font-medium font-sans-display text-[10px] uppercase tracking-[0.04em]">
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
                    const hasSelectedDay = week.days.includes(selectedDate);

                    return (
                      <div key={week.key} className="w-full">
                        {/* Week button */}
                        <button
                          type="button"
                          onClick={() => toggleWeek(week.key)}
                          aria-expanded={isWeekExpanded}
                          aria-controls={`week-${week.key}`}
                          className={cn(
                            'ml-3 flex w-full items-center gap-3 rounded-lg px-3 py-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nham-accent focus-visible:ring-offset-2',
                            hasSelectedDay
                              ? 'bg-[#C9A87C]/30 text-nham-text'
                              : 'text-nham-text-muted hover:bg-[#F0EAE0]/40 hover:text-nham-text'
                          )}
                        >
                          <span className="flex-1 text-left font-medium font-sans-display text-sm leading-5 tracking-tight">
                            {t('week', { number: week.weekNumber })}
                          </span>
                          {isWeekExpanded ? (
                            <ChevronUp className="h-4 w-4" aria-hidden="true" />
                          ) : (
                            <ChevronDown
                              className="h-4 w-4"
                              aria-hidden="true"
                            />
                          )}
                        </button>

                        {/* Day tree */}
                        {isWeekExpanded && (
                          <div
                            id={`week-${week.key}`}
                            className="mt-2 flex pl-3"
                          >
                            {/* Vertical golden line */}
                            <div className="w-0.5 shrink-0 bg-[#C9A87C]" />

                            {/* Days list */}
                            <ul className="-ml-0.5 flex flex-1 flex-col gap-2">
                              {week.days.map((date) => {
                                const isActive = date === selectedDate;
                                const isToday = date === today;
                                const hasMeal = dates.includes(date);
                                const label = isToday
                                  ? td('today')
                                  : formatDayLabel(date, locale);

                                return (
                                  <li
                                    key={date}
                                    className="flex w-full items-center"
                                  >
                                    {/* L-shaped connector */}
                                    <div className="h-2 w-[13px] shrink-0 rounded-bl-lg border-[#C9A87C] border-b-2 border-l-2" />

                                    {/* Date button */}
                                    <TimelineDateButton
                                      date={date}
                                      label={label}
                                      isActive={isActive}
                                      isToday={isToday}
                                      hasMeal={hasMeal}
                                      variant="desktop"
                                      onSelectDate={onSelectDate}
                                    />
                                  </li>
                                );
                              })}
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
