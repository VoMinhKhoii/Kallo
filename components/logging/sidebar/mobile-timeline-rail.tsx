'use client';

import { AlertCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { MobileTimelineExpandedPanel } from './mobile-timeline-expanded-panel';
import { TimelineDateButton } from './timeline-date-button';
import { formatCompactDayLabel } from './timeline-utils';

interface MobileTimelineRailProps {
  dates: string[];
  allDates: string[];
  mobileDates: string[];
  hasHiddenDates: boolean;
  today: string;
  selectedDate: string;
  isPending: boolean;
  isError: boolean;
  onRetry: () => void;
  onSelectDate: (date: string) => void;
}

export function MobileTimelineRail({
  dates,
  allDates,
  mobileDates,
  hasHiddenDates,
  today,
  selectedDate,
  isPending,
  isError,
  onRetry,
  onSelectDate,
}: MobileTimelineRailProps) {
  const t = useTranslations('logging.timelineSidebar');
  const locale = useLocale();
  const [historyOpen, setHistoryOpen] = useState(false);

  if (isPending) {
    return (
      <div className="border-nham-border border-b bg-nham-surface md:hidden">
        <div
          data-testid="mobile-timeline-skeleton"
          className="flex gap-2 overflow-hidden px-1 py-2"
        >
          {Array.from({ length: 4 }).map((_, index) => (
            <div
              key={index}
              className="h-11 w-20 shrink-0 animate-pulse rounded-xl bg-nham-border/35"
            />
          ))}
        </div>
      </div>
    );
  }

  const isEmpty = dates.length === 0 && mobileDates.length <= 1;

  return (
    <div className="border-nham-border border-b bg-nham-surface md:hidden">
      {/* Date chips rail */}
      <div className="scrollbar-thin scrollbar-track-transparent scrollbar-thumb-nham-border/50 hover:scrollbar-thumb-nham-border flex items-center gap-2 overflow-x-auto overscroll-x-contain px-4 py-2">
        {mobileDates.map((date) => (
          <TimelineDateButton
            key={date}
            date={date}
            label={formatCompactDayLabel(date, locale)}
            isActive={date === selectedDate}
            isToday={date === today}
            hasMeal={dates.includes(date)}
            variant="mobile"
            onSelectDate={onSelectDate}
          />
        ))}

        {hasHiddenDates && (
          <button
            type="button"
            onClick={() => setHistoryOpen(!historyOpen)}
            aria-expanded={historyOpen}
            aria-controls="mobile-timeline-history"
            className={cn(
              'flex min-h-11 shrink-0 items-center gap-1.5 rounded-xl px-3 py-2 font-medium font-sans-display text-[11px] text-nham-text-muted tracking-tight transition-[background-color,color] duration-150 hover:bg-nham-hover/50 hover:text-nham-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nham-accent focus-visible:ring-offset-2 focus-visible:ring-offset-nham-surface active:scale-[0.98]',
              historyOpen && 'bg-nham-hover/50 text-nham-text'
            )}
          >
            <span>{t('history')}</span>
            {historyOpen ? (
              <ChevronUp className="size-3.5" aria-hidden="true" />
            ) : (
              <ChevronDown className="size-3.5" aria-hidden="true" />
            )}
          </button>
        )}
      </div>

      {/* Error banner */}
      {isError && (
        <div className="border-nham-border border-t bg-nham-card px-4 py-3">
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 size-4 shrink-0 text-nham-destructive" />
            <div className="flex-1 space-y-2">
              <p className="text-nham-text-muted text-xs">
                {t('failedToLoadDates')}
              </p>
              <button
                type="button"
                onClick={onRetry}
                className="font-medium text-nham-accent text-xs hover:text-nham-accent/80"
              >
                {t('retryDates')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Empty state */}
      {isEmpty && !isError && (
        <div className="border-nham-border border-t bg-nham-card px-4 py-3">
          <p className="text-center text-nham-text-muted text-xs">
            {t('noPreviousMeals')}
          </p>
        </div>
      )}

      {/* Expanded history panel */}
      <MobileTimelineExpandedPanel
        dates={dates}
        allDates={allDates}
        today={today}
        selectedDate={selectedDate}
        isPending={isPending}
        isError={isError}
        onRetry={onRetry}
        onSelectDate={onSelectDate}
        open={historyOpen}
        onOpenChange={setHistoryOpen}
      />
    </div>
  );
}
