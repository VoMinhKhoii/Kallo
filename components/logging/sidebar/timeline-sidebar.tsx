'use client';

import { useQuery } from '@tanstack/react-query';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import { loadMealDates } from '@/lib/actions/meals';
import { cn } from '@/lib/utils';

interface TimelineSidebarProps {
  userId: string;
  selectedDate: string;
  onSelectDate: (date: string) => void;
}

interface WeekSection {
  key: string;
  label: string;
  days: string[];
}

interface MonthSection {
  key: string;
  label: string;
  weeks: WeekSection[];
}

function formatDayLabel(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00`);
  const weekday = d.toLocaleDateString('en-US', { weekday: 'short' });
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
        label: `Week ${weekNum}`,
        days,
      }));
    return {
      key: monthKey,
      label: `${Number.parseInt(monthKey, 10)}/${monthKey.split('-')[1]}`,
      weeks,
    };
  });
}

export function TimelineSidebar({
  userId,
  selectedDate,
  onSelectDate,
}: TimelineSidebarProps) {
  const timezoneOffset = new Date().getTimezoneOffset();
  const { data: dates = [] } = useQuery({
    queryKey: ['meal-dates', userId, timezoneOffset],
    queryFn: () => loadMealDates({ timezoneOffset }),
    staleTime: 60_000,
  });

  const today = useMemo(() => {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }, []);

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
      className="flex h-full w-[212px] shrink-0 flex-col gap-3 overflow-y-auto border-border/40 border-r py-3 pr-3"
      aria-label="Timeline navigation"
    >
      {months.map((month) => {
        const isMonthExpanded = expandedMonths.has(month.key);

        return (
          <div key={month.key} className="flex flex-col gap-2">
            {/* Month header */}
            <button
              type="button"
              onClick={() => toggleMonth(month.key)}
              aria-expanded={isMonthExpanded}
              aria-controls={`month-${month.key}`}
              className="flex items-center gap-2 px-3 transition-colors hover:text-nham-text"
            >
              <span
                className="flex-1 text-left font-medium text-[10px] text-muted-foreground uppercase tracking-[0.04em]"
                style={{ fontFamily: 'DM Sans, sans-serif' }}
              >
                {month.label}
              </span>
              {isMonthExpanded ? (
                <ChevronUp className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              )}
            </button>

            {isMonthExpanded && (
              <>
                <div className="h-0.5 rounded-sm bg-neutral-100" />
                <div id={`month-${month.key}`} className="flex flex-col gap-2">
                  {month.weeks.map((week) => {
                    const isWeekExpanded = expandedWeeks.has(week.key);
                    const hasSelectedDay = week.days.includes(selectedDate);

                    return (
                      <div key={week.key}>
                        {/* Week button */}
                        <button
                          type="button"
                          onClick={() => toggleWeek(week.key)}
                          aria-expanded={isWeekExpanded}
                          aria-controls={`week-${week.key}`}
                          className={cn(
                            'flex w-full items-center gap-3 rounded-lg px-3 py-2 transition-colors',
                            hasSelectedDay && 'bg-nham-accent/30',
                            !hasSelectedDay && 'hover:bg-nham-hover/40'
                          )}
                        >
                          <span
                            className="flex-1 text-left font-medium text-foreground text-sm tracking-tight"
                            style={{ fontFamily: 'DM Sans, sans-serif' }}
                          >
                            {week.label}
                          </span>
                          {isWeekExpanded ? (
                            <ChevronUp className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <ChevronDown className="h-4 w-4 text-muted-foreground" />
                          )}
                        </button>

                        {/* Days tree */}
                        {isWeekExpanded && (
                          <div
                            id={`week-${week.key}`}
                            className="mt-1 flex pl-3"
                          >
                            <div className="w-0.5 shrink-0 bg-nham-accent" />
                            <ul className="-ml-0.5 flex flex-col gap-2">
                              {week.days.map((date) => {
                                const isActive = date === selectedDate;
                                const isToday = date === today;

                                return (
                                  <li
                                    key={date}
                                    className="flex w-full items-center"
                                  >
                                    <div className="h-2 w-[13px] shrink-0 rounded-bl-lg border-nham-accent border-b-2 border-l-2" />
                                    <button
                                      type="button"
                                      onClick={() => onSelectDate(date)}
                                      aria-current={
                                        isActive ? 'date' : undefined
                                      }
                                      className={cn(
                                        'flex flex-1 items-center rounded-lg px-3 py-2',
                                        isActive && 'bg-nham-accent/30'
                                      )}
                                    >
                                      <span
                                        className={cn(
                                          'flex-1 text-left font-medium text-xs tracking-tight',
                                          isActive
                                            ? 'text-foreground'
                                            : 'text-muted-foreground'
                                        )}
                                        style={{
                                          fontFamily: 'DM Sans, sans-serif',
                                        }}
                                      >
                                        {isToday
                                          ? 'Today'
                                          : formatDayLabel(date)}
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
              </>
            )}
          </div>
        );
      })}
    </nav>
  );
}
