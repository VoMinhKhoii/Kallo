'use client';

import { CalendarDays } from 'lucide-react';
import dynamic from 'next/dynamic';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

/**
 * react-day-picker is the one heavy thing on this page, and most sessions
 * never open the calendar — the tree already covers the days around today.
 * Loading the panel on demand keeps it out of the logging route's bundle.
 */
const TimelineCalendarPanel = dynamic(
  () =>
    import('./timeline-calendar-panel').then(
      (mod) => mod.TimelineCalendarPanel
    ),
  { ssr: false }
);

interface TimelineCalendarProps {
  today: string;
  selectedDate: string;
  dailyKcal: Map<string, number | null>;
  onSelectDate: (date: string) => void;
}

/**
 * The way out of the tree.
 *
 * The day tree only covers months that hold a log, so a month you never opened
 * the app in has no row to click. This reaches those.
 */
export function TimelineCalendar({
  today,
  selectedDate,
  dailyKcal,
  onSelectDate,
}: TimelineCalendarProps) {
  const t = useTranslations('logging.timelineSidebar');
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger className="ml-3 flex w-[calc(100%-0.75rem)] min-w-0 touch-manipulation items-center gap-2 rounded-xl border border-kallo-border/60 px-2.5 py-2 font-medium font-sans-display text-kallo-text text-xs transition-colors hover:border-kallo-accent/50 hover:bg-kallo-hover/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kallo-accent focus-visible:ring-offset-2">
        <CalendarDays
          className="h-3.5 w-3.5 shrink-0 text-kallo-text-muted"
          aria-hidden="true"
        />
        <span className="min-w-0 flex-1 truncate text-left">
          {t('openCalendar')}
        </span>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto p-0">
        <TimelineCalendarPanel
          today={today}
          selectedDate={selectedDate}
          dailyKcal={dailyKcal}
          onSelectDate={(date) => {
            onSelectDate(date);
            setIsOpen(false);
          }}
        />
      </PopoverContent>
    </Popover>
  );
}
