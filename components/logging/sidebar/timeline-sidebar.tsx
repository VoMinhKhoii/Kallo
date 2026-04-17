'use client';

import { useQuery } from '@tanstack/react-query';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { loadMealDates } from '@/lib/actions/meals';
import { cn } from '@/lib/utils';

interface TimelineSidebarProps {
  userId: string;
  selectedDate: string;
  onSelectDate: (date: string) => void;
}

interface WeekSection {
  key: string;
  weekNumber: number;
  days: string[];
}

interface MonthSection {
  key: string;
  month: number;
  year: number;
  weeks: WeekSection[];
}

function formatDayLabel(dateStr: string, locale: string): string {
  const d = new Date(`${dateStr}T00:00:00`);
  const weekday = d.toLocaleDateString(locale, { weekday: 'short' });
  const day = d.getDate();
  const month = d.getMonth() + 1;
  return `${weekday} - ${day}/${month}`;
}

function weekOfMonth(dateStr: string): number {
  const day = Number.parseInt(dateStr.split('-')[2], 10);
  return Math.ceil(day / 7);
}

function groupByMonth(dates: string[]): MonthSection[] {
  // Group dates into month → week buckets
  const monthMap = new Map<string, Map<number, string[]>>();
  for (const date of dates) {
    const [y, m] = date.split('-');
    const monthKey = `${m}-${y}`;
    if (!monthMap.has(monthKey)) monthMap.set(monthKey, new Map());
    const weekNum = weekOfMonth(date);
    const weekMap = monthMap.get(monthKey)!;
    const existing = weekMap.get(weekNum) ?? [];
    existing.push(date);
    weekMap.set(weekNum, existing);
  }

  return Array.from(monthMap.entries()).map(([monthKey, weekMap]) => {
    const weeks: WeekSection[] = Array.from(weekMap.entries())
      .sort(([a], [b]) => a - b)
      .map(([weekNum, days]) => ({
        key: `${monthKey}-w${weekNum}`,
        weekNumber: weekNum,
        days,
      }));
    const [month, year] = monthKey.split('-');
    return {
      key: monthKey,
      month: Number.parseInt(month, 10),
      year: Number.parseInt(year, 10),
      weeks,
    };
  });
}

export function TimelineSidebar({
  userId,
  selectedDate,
  onSelectDate,
}: TimelineSidebarProps) {
  const t = useTranslations('logging.timelineSidebar');
  const td = useTranslations('dashboard');
  const locale = useLocale();
  const timezoneOffset = new Date().getTimezoneOffset();
  const { data: dates = [] } = useQuery({
    queryKey: ['meal-dates', userId, timezoneOffset],
    queryFn: () => loadMealDates({ timezoneOffset }),
    staleTime: 60_000,
  });

  const today = (() => {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  })();

  const allDates = useMemo(() => {
    const set = new Set(dates);
    set.add(today);
    return Array.from(set).sort().reverse();
  }, [dates, today]);

  const months = useMemo(() => groupByMonth(allDates), [allDates]);

  const selectedMonth = useMemo(() => {
    const [y, m] = selectedDate.split('-');
    return `${m}-${y}`;
  }, [selectedDate]);

  const selectedWeekKey = useMemo(() => {
    const [y, m] = selectedDate.split('-');
    return `${m}-${y}-w${weekOfMonth(selectedDate)}`;
  }, [selectedDate]);

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

  return (
    <nav
      className="flex h-full w-[212px] shrink-0 flex-col items-start gap-3 overflow-y-auto border-border/40 border-r py-3 pr-3"
      aria-label={t('navigationLabel')}
    >
      {months.map((month) => {
        const isMonthExpanded = expandedMonths.has(month.key);

        return (
          <div key={month.key} className="flex w-full flex-col gap-3">
            <div className="flex w-full flex-col gap-2">
              <button
                type="button"
                onClick={() => toggleMonth(month.key)}
                aria-expanded={isMonthExpanded}
                aria-controls={`month-${month.key}`}
                className="flex w-full items-center gap-2 px-3 transition-colors hover:text-nham-text"
              >
                <span
                  className="flex flex-1 items-center font-medium text-[10px] text-muted-foreground tracking-[0.04em]"
                  style={{ fontFamily: 'DM Sans, sans-serif' }}
                >
                  {month.month}/{month.year}
                </span>
                {isMonthExpanded ? (
                  <ChevronUp className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                )}
              </button>

              {isMonthExpanded && (
                <div
                  id={`month-${month.key}`}
                  className="flex w-full flex-col items-start gap-1"
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
                            'flex w-full items-center gap-3 rounded-lg px-3 py-2 transition-colors',
                            hasSelectedDay
                              ? 'bg-nham-accent/40'
                              : 'hover:bg-nham-hover/40'
                          )}
                        >
                          <span
                            className="flex-1 text-left font-medium text-foreground text-sm leading-5 tracking-tight"
                            style={{ fontFamily: 'DM Sans, sans-serif' }}
                          >
                            {t('week', { number: week.weekNumber })}
                          </span>
                          {isWeekExpanded ? (
                            <ChevronUp className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <ChevronDown className="h-4 w-4 text-muted-foreground" />
                          )}
                        </button>

                        {isWeekExpanded && (
                          <div
                            id={`week-${week.key}`}
                            className="flex w-full items-start pl-3"
                          >
                            <div className="w-0.5 self-stretch bg-nham-accent" />
                            <ul className="-ml-0.5 flex flex-1 flex-col items-start gap-2">
                              {week.days.map((date) => {
                                const isActive = date === selectedDate;
                                const isToday = date === today;

                                return (
                                  <li
                                    key={date}
                                    className="flex w-full items-center gap-3 py-2 pr-3"
                                  >
                                    <div className="h-2 w-[13px] shrink-0 rounded-bl-lg border-nham-accent border-b-2 border-l-2" />
                                    <button
                                      type="button"
                                      onClick={() => onSelectDate(date)}
                                      aria-current={
                                        isActive ? 'date' : undefined
                                      }
                                      className={cn(
                                        'flex flex-1 items-center self-stretch rounded-lg px-3 py-2 hover:bg-nham-hover/40',
                                        isActive && 'bg-nham-accent/40'
                                      )}
                                    >
                                      <span
                                        className={cn(
                                          'flex-1 text-left font-medium text-sm tracking-tight',
                                          isActive
                                            ? 'text-foreground'
                                            : 'text-muted-foreground'
                                        )}
                                        style={{
                                          fontFamily: 'DM Sans, sans-serif',
                                        }}
                                      >
                                        {isToday
                                          ? td('today')
                                          : formatDayLabel(date, locale)}
                                      </span>
                                    </button>
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

            <div className="h-px w-full rounded-sm bg-neutral-100" />
          </div>
        );
      })}
    </nav>
  );
}
