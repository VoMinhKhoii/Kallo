'use client';

import { ChevronDown, ChevronUp } from 'lucide-react';
import { useCallback, useState } from 'react';
import { cn } from '@/lib/utils';

interface DayItem {
  id: string;
  label: string;
  active?: boolean;
}

interface WeekItem {
  id: string;
  label: string;
  active?: boolean;
  expanded?: boolean;
  days?: DayItem[];
}

interface MonthSection {
  id: string;
  label: string;
  expanded: boolean;
  weeks?: WeekItem[];
}

const initialMonths: MonthSection[] = [
  { id: '1-2026', label: '1/2026', expanded: false },
  {
    id: '2-2026',
    label: '2/2026',
    expanded: true,
    weeks: [
      { id: 'week-1', label: 'Week 1' },
      { id: 'week-2', label: 'Week 2' },
      { id: 'week-3', label: 'Week 3' },
      {
        id: 'week-4',
        label: 'Week 4',
        active: true,
        expanded: true,
        days: [
          { id: 'mon-16-2', label: 'Mon - 16/2' },
          { id: 'tue-17-2', label: 'Tue - 17/2' },
          {
            id: 'wed-18-2',
            label: 'Wed - 18/2',
            active: true,
          },
        ],
      },
    ],
  },
];

export function TimelineSidebar() {
  const [months, setMonths] = useState<MonthSection[]>(initialMonths);

  const toggleMonth = useCallback((monthId: string) => {
    setMonths((prev) =>
      prev.map((m) => (m.id === monthId ? { ...m, expanded: !m.expanded } : m))
    );
  }, []);

  const toggleWeek = useCallback((monthId: string, weekId: string) => {
    setMonths((prev) =>
      prev.map((m) =>
        m.id === monthId && m.weeks
          ? {
              ...m,
              weeks: m.weeks.map((w) =>
                w.id === weekId ? { ...w, expanded: !w.expanded } : w
              ),
            }
          : m
      )
    );
  }, []);

  return (
    <nav
      className="flex h-full w-[212px] shrink-0 flex-col gap-3 overflow-y-auto border-border/40 border-r py-3 pr-3"
      aria-label="Timeline navigation"
    >
      {months.map((month) => (
        <div key={month.id} className="flex flex-col gap-2">
          {/* Month header */}
          <button
            type="button"
            onClick={() => toggleMonth(month.id)}
            className="flex items-center gap-2 px-3 transition-colors hover:text-[#2C2416]"
          >
            <span
              className="flex-1 text-left font-medium text-[10px] text-muted-foreground uppercase tracking-[0.04em]"
              style={{
                fontFamily: 'DM Sans, sans-serif',
              }}
            >
              {month.label}
            </span>
            {month.expanded ? (
              <ChevronUp className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            )}
          </button>

          {month.expanded && month.weeks && (
            <>
              <div className="h-0.5 rounded-sm bg-neutral-100" />
              <div className="flex flex-col gap-1">
                {month.weeks.map((week) => {
                  const hasDays = week.days && week.days.length > 0;
                  const isExpanded = week.expanded ?? false;

                  return (
                    <div key={week.id}>
                      {/* Week button */}
                      <button
                        type="button"
                        onClick={() => hasDays && toggleWeek(month.id, week.id)}
                        className={cn(
                          'flex w-full items-center gap-3 rounded-lg px-3 py-2 transition-colors',
                          week.active && 'bg-[#C9A87C]/30',
                          hasDays && 'hover:bg-[#F0EAE0]/40'
                        )}
                      >
                        <span
                          className="flex-1 text-left font-medium text-foreground text-sm tracking-tight"
                          style={{
                            fontFamily: 'DM Sans, sans-serif',
                          }}
                        >
                          {week.label}
                        </span>
                        {hasDays &&
                          (isExpanded ? (
                            <ChevronUp className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <ChevronDown className="h-4 w-4 text-muted-foreground" />
                          ))}
                      </button>

                      {/* Days tree */}
                      {hasDays && isExpanded && (
                        <div className="flex pl-3">
                          <div className="w-0.5 shrink-0 bg-[#C9A87C]" />
                          <ul className="-ml-0.5 flex flex-col gap-2">
                            {week.days!.map((day) => (
                              <li
                                key={day.id}
                                className="flex w-full items-center"
                              >
                                <div className="h-2 w-[13px] shrink-0 rounded-bl-lg border-[#C9A87C] border-b-2 border-l-2" />
                                <button
                                  type="button"
                                  className={cn(
                                    'flex flex-1 items-center rounded-lg px-3 py-2',
                                    day.active && 'bg-[#C9A87C]/30'
                                  )}
                                >
                                  <span
                                    className={cn(
                                      'flex-1 text-left font-medium text-xs tracking-tight',
                                      day.active
                                        ? 'text-foreground'
                                        : 'text-muted-foreground'
                                    )}
                                    style={{
                                      fontFamily: 'DM Sans, sans-serif',
                                    }}
                                  >
                                    {day.label}
                                  </span>
                                </button>
                              </li>
                            ))}
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
      ))}
    </nav>
  );
}
