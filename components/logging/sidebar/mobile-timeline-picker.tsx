'use client';

import { AlertCircle, Calendar as CalendarIcon } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
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
  formatMobileChipDate,
  getMobileChipRelativeLabel,
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
  today,
  selectedDate,
  isPending,
  isError,
  onRetry,
  onSelectDate,
}: MobileTimelinePickerProps) {
  const t = useTranslations('logging.timelineSidebar');
  const locale = useLocale();
  const [open, setOpen] = useState(false);

  const hasMeal = dates.includes(selectedDate);
  const relativeLabel = getMobileChipRelativeLabel({
    date: selectedDate,
    today,
    locale,
  });
  const formattedDate = formatMobileChipDate(selectedDate, locale);

  const handleSelectDate = (date: Date | undefined) => {
    if (date) {
      const dateStr = dateToDateString(date);
      onSelectDate(dateStr);
      setOpen(false);
    }
  };

  if (isPending) {
    return (
      <div className="md:hidden">
        <Skeleton className="h-12 w-48" data-testid="mobile-picker-skeleton" />
      </div>
    );
  }

  if (isError) {
    return (
      <div
        className="flex items-center gap-2 md:hidden"
        data-testid="mobile-picker-error"
      >
        <div className="flex items-center gap-2 text-destructive text-sm">
          <AlertCircle className="size-4" aria-hidden="true" />
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
    );
  }

  let relativeLabelText = '';
  switch (relativeLabel.kind) {
    case 'today':
      relativeLabelText = t('todayLabel');
      break;
    case 'yesterday':
      relativeLabelText = t('yesterdayLabel');
      break;
    case 'lastWeekday':
      relativeLabelText = t('lastWeekdayLabel', {
        weekday: relativeLabel.weekday,
      });
      break;
    case 'date':
      relativeLabelText = t('selectedDateLabel');
      break;
  }

  return (
    <Drawer open={open} onOpenChange={setOpen} direction="top">
      <div className="md:hidden">
        <DrawerTrigger asChild>
          <button
            type="button"
            className={cn(
              'flex items-center gap-2 rounded-lg border border-input bg-background px-3 py-2.5 text-left shadow-xs outline-none transition-colors hover:bg-accent focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50'
            )}
            aria-label={t('selectDate')}
          >
            <div className="flex flex-1 flex-col">
              <div className="flex items-center gap-1.5">
                <span className="font-medium text-sm">{relativeLabelText}</span>
                {hasMeal && (
                  <span
                    className="inline-block size-1.5 rounded-full bg-primary"
                    role="status"
                    aria-label={t('hasMealIndicator')}
                  />
                )}
              </div>
              <span className="text-muted-foreground text-xs">
                {formattedDate}
              </span>
            </div>
            <CalendarIcon
              className="size-4 text-muted-foreground"
              aria-hidden="true"
            />
          </button>
        </DrawerTrigger>
      </div>

      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>{t('datePickerTitle')}</DrawerTitle>
          <DrawerDescription>{t('datePickerDescription')}</DrawerDescription>
        </DrawerHeader>
        <div className="px-4 pb-6">
          <Calendar
            mode="single"
            selected={dateStringToDate(selectedDate)}
            onSelect={handleSelectDate}
            modifiers={{
              hasMeal: dates.map(dateStringToDate),
            }}
            modifiersClassNames={{
              hasMeal:
                'relative after:absolute after:bottom-1 after:left-1/2 after:-translate-x-1/2 after:size-1 after:rounded-full after:bg-primary',
            }}
          />
        </div>
      </DrawerContent>
    </Drawer>
  );
}
