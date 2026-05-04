'use client';

import { AlertCircle, Calendar as CalendarIcon } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import { enUS, vi } from 'react-day-picker/locale';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from '@/components/ui/drawer';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import {
  dateStringToDate,
  dateToDateString,
  formatTimelineDayLabel,
} from './timeline-utils';

export interface MobileTimelinePickerProps {
  dates: string[];
  allDates: string[];
  today: string;
  selectedDate: string;
  isPending: boolean;
  isError: boolean;
  onRetry: () => void;
  onSelectDate: (date: string) => void;
}

export function MobileTimelinePicker({
  dates,
  // allDates is kept for future use (calendar bounds/indicators)
  allDates: _allDates,
  today: _today,
  selectedDate,
  isPending,
  isError,
  onRetry,
  onSelectDate,
}: MobileTimelinePickerProps) {
  const t = useTranslations('logging.timelineSidebar');
  const locale = useLocale();
  const [open, setOpen] = useState(false);

  const selectedDateValue = dateStringToDate(selectedDate);
  const dayPickerLocale = locale === 'vi' ? vi : enUS;
  const hasMeal = dates.includes(selectedDate);
  const formattedDate = formatTimelineDayLabel(selectedDate, locale);

  const handleSelectDate = (date: Date | undefined) => {
    if (date) {
      const dateStr = dateToDateString(date);
      onSelectDate(dateStr);
      setOpen(false);
    }
  };

  if (isPending) {
    return (
      <div className="flex justify-center md:hidden">
        <Skeleton
          className="h-9 w-44 rounded-full"
          data-testid="mobile-picker-skeleton"
        />
      </div>
    );
  }

  return (
    <Drawer open={open} onOpenChange={setOpen} direction="top">
      <div className="flex flex-col items-center gap-2 md:hidden">
        <DrawerTrigger asChild>
          <button
            type="button"
            className={cn(
              'inline-flex h-9 max-w-[min(18rem,calc(100vw-2rem))] items-center gap-2 rounded-full border border-nham-border/70 bg-nham-surface px-3.5 font-semibold text-[12px] text-nham-text shadow-sm outline-none transition-colors hover:border-nham-accent/40 hover:bg-nham-hover/50 focus-visible:border-nham-accent focus-visible:ring-[3px] focus-visible:ring-nham-accent/20'
            )}
            aria-label={t('selectDate')}
          >
            <CalendarIcon
              className="size-3.5 shrink-0 text-nham-accent"
              aria-hidden="true"
            />
            <span className="min-w-0 truncate">{formattedDate}</span>
            {hasMeal && (
              <span
                className="inline-block size-1.5 shrink-0 rounded-full bg-nham-accent"
                role="status"
                aria-label={t('hasMealIndicator')}
              />
            )}
          </button>
        </DrawerTrigger>

        {isError && (
          <div
            className="flex max-w-[min(22rem,calc(100vw-2rem))] items-center gap-2 rounded-full border border-destructive/30 bg-destructive/5 px-3 py-1.5"
            data-testid="mobile-picker-error"
          >
            <div className="flex flex-1 items-center gap-1.5 text-destructive text-xs">
              <AlertCircle className="size-3.5 shrink-0" aria-hidden="true" />
              <span>{t('failedToLoadDates')}</span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={onRetry}
              aria-label={t('retryDates')}
            >
              {t('retryDates')}
            </Button>
          </div>
        )}
      </div>

      <DrawerContent className="rounded-b-3xl border-nham-border bg-nham-surface shadow-xl">
        <DrawerHeader className="items-center px-5 pt-5 pb-2">
          <DrawerTitle className="font-semibold text-[15px] text-nham-text">
            {t('datePickerTitle')}
          </DrawerTitle>
          <DrawerDescription className="max-w-xs text-center text-nham-text-muted text-xs">
            {t('datePickerDescription')}
          </DrawerDescription>
        </DrawerHeader>
        <div className="flex justify-center px-4 pb-6">
          <div className="w-full max-w-[22rem] rounded-3xl border border-nham-border/60 bg-background p-2 shadow-sm">
            <Calendar
              mode="single"
              selected={selectedDateValue}
              defaultMonth={selectedDateValue}
              onSelect={handleSelectDate}
              locale={dayPickerLocale}
              modifiers={{
                hasMeal: dates.map(dateStringToDate),
              }}
              modifiersClassNames={{
                hasMeal:
                  'relative after:absolute after:bottom-1 after:left-1/2 after:-translate-x-1/2 after:size-1 after:rounded-full after:bg-nham-accent',
              }}
            />
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
