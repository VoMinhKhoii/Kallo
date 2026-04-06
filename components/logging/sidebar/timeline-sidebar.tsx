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

interface MonthSection {
  key: string;
  label: string;
  days: string[];
}

function formatDayLabel(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00`);
  const weekday = d.toLocaleDateString('en-US', { weekday: 'short' });
  const day = d.getDate();
  const month = d.getMonth() + 1;
  return `${weekday} - ${day}/${month}`;
}

function groupByMonth(dates: string[]): MonthSection[] {
  const map = new Map<string, string[]>();
  for (const date of dates) {
    const [y, m] = date.split('-');
    const key = `${m}-${y}`;
    const existing = map.get(key) ?? [];
    existing.push(date);
    map.set(key, existing);
  }
  return Array.from(map.entries()).map(([key, days]) => ({
    key,
    label: `${Number.parseInt(key, 10)}/${key.split('-')[1]}`,
    days,
  }));
}

export function TimelineSidebar({
  userId,
  selectedDate,
  onSelectDate,
}: TimelineSidebarProps) {
  const timezoneOffset = new Date().getTimezoneOffset();
  const { data: dates = [] } = useQuery({
    queryKey: ['meal-dates', userId],
    queryFn: () => loadMealDates({ timezoneOffset }),
    staleTime: 60_000,
  });

  // Add today if not in the list
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

  // Expand the month containing selectedDate by default
  const selectedMonth = useMemo(() => {
    const [y, m] = selectedDate.split('-');
    return `${m}-${y}`;
  }, [selectedDate]);

  const [expandedMonths, setExpandedMonths] = useState<Set<string>>(
    () => new Set([selectedMonth])
  );

  const toggleMonth = useCallback((monthKey: string) => {
    setExpandedMonths((prev) => {
      const next = new Set(prev);
      if (next.has(monthKey)) {
        next.delete(monthKey);
      } else {
        next.add(monthKey);
      }
      return next;
    });
  }, []);

  return (
    <nav
      className="flex h-full w-[212px] shrink-0 flex-col gap-3 overflow-y-auto border-border/40 border-r py-3 pr-3"
      aria-label="Timeline navigation"
    >
      {months.map((month) => {
        const isExpanded = expandedMonths.has(month.key);

        return (
          <div key={month.key} className="flex flex-col gap-2">
            {/* Month header */}
            <button
              type="button"
              onClick={() => toggleMonth(month.key)}
              aria-expanded={isExpanded}
              aria-controls={`month-${month.key}`}
              className="flex items-center gap-2 px-3 transition-colors hover:text-nham-text"
            >
              <span
                className="flex-1 text-left font-medium text-[10px] text-muted-foreground uppercase tracking-[0.04em]"
                style={{ fontFamily: 'DM Sans, sans-serif' }}
              >
                {month.label}
              </span>
              {isExpanded ? (
                <ChevronUp className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              )}
            </button>

            {isExpanded && (
              <>
                <div className="h-0.5 rounded-sm bg-neutral-100" />
                <div id={`month-${month.key}`} className="flex flex-col gap-1">
                  {month.days.map((date) => {
                    const isActive = date === selectedDate;
                    const isToday = date === today;

                    return (
                      <button
                        key={date}
                        type="button"
                        onClick={() => onSelectDate(date)}
                        aria-current={isActive ? 'date' : undefined}
                        className={cn(
                          'flex w-full items-center gap-3 rounded-lg px-3 py-2 transition-colors',
                          isActive && 'bg-nham-accent/30',
                          !isActive && 'hover:bg-nham-hover/40'
                        )}
                      >
                        <span
                          className={cn(
                            'flex-1 text-left font-medium text-xs tracking-tight',
                            isActive
                              ? 'text-foreground'
                              : 'text-muted-foreground'
                          )}
                          style={{ fontFamily: 'DM Sans, sans-serif' }}
                        >
                          {isToday ? 'Today' : formatDayLabel(date)}
                        </span>
                      </button>
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
