'use client';

import { CalendarDays, X } from 'lucide-react';
import dynamic from 'next/dynamic';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import type { MealDateIndex } from '@/lib/domain/logging/meal-date-index';
import { CalendarLegend } from './calendar-legend';

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
        className="h-[21rem] w-full rounded-xl bg-kallo-track motion-safe:animate-pulse"
      />
    ),
  }
);

interface TimelineCalendarProps {
  today: string;
  selectedDate: string;
  mealDates: MealDateIndex;
  /** The kcal goal each day's ring fills toward. */
  calorieTarget: number | null;
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
  calorieTarget,
  onSelectDate,
}: TimelineCalendarProps) {
  const t = useTranslations('logging.timelineSidebar');
  const tCommon = useTranslations('common');
  const [isOpen, setIsOpen] = useState(false);

  const selectAndClose = (date: string) => {
    onSelectDate(date);
    setIsOpen(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger className="ml-3 flex w-[calc(100%-0.75rem)] min-w-0 touch-manipulation items-center justify-center gap-2 rounded-xl border border-kallo-border/60 px-2.5 py-2 font-medium font-sans-display text-kallo-text text-xs transition-colors hover:border-kallo-accent/50 hover:bg-kallo-hover/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kallo-accent focus-visible:ring-offset-2">
        <CalendarDays
          className="h-3.5 w-3.5 shrink-0 text-kallo-text-muted"
          aria-hidden="true"
        />
        <span className="min-w-0 truncate">{t('openCalendar')}</span>
      </DialogTrigger>
      {/* The shared close button's screen-reader text is hard-coded English in
          components/ui/dialog.tsx, which would put a "Close" inside an
          otherwise Vietnamese dialog. Opt out and supply a translated one, the
          way responsive-sheet and mobile-nav already do. (The shadcn file is
          CLI-managed — every other dialog in the app has the same gap, and
          fixing it at the source is its own change.) */}
      {/* The house dialog anatomy (Share Meal, Log weight): editorial Lora
          title top-left, a body, and a hairline-separated footer. A column
          rather than the primitive's grid, for the same reason Share Meal
          gives: flex items stretch to the card, grid items size to content. */}
      <DialogContent
        className="flex flex-col gap-0 rounded-2xl border-kallo-border/60 bg-white p-0 sm:max-w-[404px]"
        showCloseButton={false}
      >
        <DialogHeader className="gap-1 px-[22px] pt-5 text-left sm:text-left">
          <DialogTitle className="font-normal font-serif text-[22px] text-kallo-text leading-tight">
            {t('datePickerTitle')}
          </DialogTitle>
          {/* Clears the close button pinned top-right. */}
          <DialogDescription className="pr-[26px] font-sans-display text-[13px] text-kallo-text-muted">
            {t('datePickerDescription')}
          </DialogDescription>
        </DialogHeader>
        <DialogClose className="absolute top-3.5 right-3.5 flex size-8 items-center justify-center rounded-full text-kallo-text-muted transition-colors hover:bg-kallo-hover/60 hover:text-kallo-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kallo-accent focus-visible:ring-offset-2">
          <X className="size-4" aria-hidden="true" />
          <span className="sr-only">{tCommon('close')}</span>
        </DialogClose>
        <div className="px-5 pt-4 pb-1">
          <TimelineCalendarPanel
            today={today}
            selectedDate={selectedDate}
            mealDates={mealDates}
            calorieTarget={calorieTarget}
            onSelectDate={selectAndClose}
          />
        </div>
        <DialogFooter className="mt-3 items-center justify-between border-kallo-border/60 border-t px-[22px] py-3">
          <CalendarLegend />
          <Button
            variant="outline"
            size="sm"
            className="shrink-0 rounded-xl"
            onClick={() => selectAndClose(today)}
          >
            {t('todayLabel')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
