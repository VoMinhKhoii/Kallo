'use client';

import { CalendarDays, X } from 'lucide-react';
import dynamic from 'next/dynamic';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import type { MealDateIndex } from '@/lib/domain/logging/meal-date-index';

/**
 * react-day-picker is the one heavy thing on this page, and most sessions
 * never open the calendar — the tree already covers the days around today.
 * Loading the panel on demand keeps it out of the logging route's bundle.
 *
 * The dialog is modal, so an empty box while the chunk lands would be the
 * whole screen's focus: `loading` holds the grid's footprint until it does.
 */
const TimelineCalendarPanel = dynamic(
  () =>
    import('./timeline-calendar-panel').then(
      (mod) => mod.TimelineCalendarPanel
    ),
  {
    ssr: false,
    loading: () => (
      <div
        aria-hidden="true"
        className="mx-auto h-[17.5rem] w-[15rem] rounded-xl bg-kallo-track motion-safe:animate-pulse"
      />
    ),
  }
);

interface TimelineCalendarProps {
  today: string;
  selectedDate: string;
  mealDates: MealDateIndex;
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
  mealDates,
  onSelectDate,
}: TimelineCalendarProps) {
  const t = useTranslations('logging.timelineSidebar');
  const tCommon = useTranslations('common');
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger className="ml-3 flex w-[calc(100%-0.75rem)] min-w-0 touch-manipulation items-center gap-2 rounded-xl border border-kallo-border/60 px-2.5 py-2 font-medium font-sans-display text-kallo-text text-xs transition-colors hover:border-kallo-accent/50 hover:bg-kallo-hover/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kallo-accent focus-visible:ring-offset-2">
        <CalendarDays
          className="h-3.5 w-3.5 shrink-0 text-kallo-text-muted"
          aria-hidden="true"
        />
        <span className="min-w-0 flex-1 truncate text-left">
          {t('openCalendar')}
        </span>
      </DialogTrigger>
      {/* The shared close button's screen-reader text is hard-coded English in
          components/ui/dialog.tsx, which would put a "Close" inside an
          otherwise Vietnamese dialog. Opt out and supply a translated one, the
          way responsive-sheet and mobile-nav already do. (The shadcn file is
          CLI-managed — every other dialog in the app has the same gap, and
          fixing it at the source is its own change.) */}
      <DialogContent className="sm:max-w-sm" showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>{t('datePickerTitle')}</DialogTitle>
          <DialogDescription>{t('datePickerDescription')}</DialogDescription>
        </DialogHeader>
        <DialogClose className="absolute top-4 right-4 flex size-8 items-center justify-center rounded-full text-kallo-text-muted opacity-70 transition-opacity hover:bg-kallo-hover/40 hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kallo-accent focus-visible:ring-offset-2">
          <X className="size-4" aria-hidden="true" />
          <span className="sr-only">{tCommon('close')}</span>
        </DialogClose>
        <TimelineCalendarPanel
          today={today}
          selectedDate={selectedDate}
          mealDates={mealDates}
          onSelectDate={(date) => {
            onSelectDate(date);
            setIsOpen(false);
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
