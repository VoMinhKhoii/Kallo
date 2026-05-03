'use client';

import { AlertCircle, ChevronRight } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { TimelineDateButton } from './timeline-date-button';
import {
  formatDayLabel,
  groupByMonth,
  type MonthSection,
} from './timeline-utils';

interface MobileTimelineExpandedPanelProps {
  dates: string[];
  allDates: string[];
  today: string;
  selectedDate: string;
  isPending: boolean;
  isError: boolean;
  onRetry: () => void;
  onSelectDate: (date: string) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function MobileTimelineExpandedPanel({
  dates,
  allDates,
  today,
  selectedDate,
  isPending,
  isError,
  onRetry,
  onSelectDate,
  open,
  onOpenChange,
}: MobileTimelineExpandedPanelProps) {
  const t = useTranslations('logging.timelineSidebar');
  const locale = useLocale();

  if (!open) {
    return null;
  }

  const handleDateSelect = (date: string) => {
    onSelectDate(date);
    onOpenChange(false);
  };

  if (isPending) {
    return (
      <div
        className="fade-in-0 slide-in-from-top-2 animate-in border-nham-border border-t bg-nham-card px-4 py-4 duration-200"
        data-testid="mobile-timeline-history-skeleton"
      >
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="space-y-2">
              <div className="h-5 w-24 animate-pulse rounded bg-nham-border/35" />
              <div className="flex flex-wrap gap-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div
                    key={i}
                    className="h-10 w-20 shrink-0 animate-pulse rounded-xl bg-nham-border/35"
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div
        className="fade-in-0 slide-in-from-top-2 animate-in border-nham-border border-t bg-nham-card px-4 py-4 duration-200"
        data-testid="mobile-timeline-history-error"
      >
        <div className="flex items-start gap-3">
          <AlertCircle className="mt-0.5 size-5 shrink-0 text-nham-destructive" />
          <div className="flex-1 space-y-3">
            <p className="text-nham-text-muted text-sm">
              {t('failedToLoadHistory')}
            </p>
            <button
              type="button"
              onClick={onRetry}
              className="font-medium text-nham-accent text-sm hover:text-nham-accent/80"
            >
              {t('retryDates')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  const sections = groupByMonth(allDates);

  return (
    <nav
      id="mobile-timeline-history"
      aria-label={t('historyNavigationLabel')}
      className="fade-in-0 slide-in-from-top-2 max-h-[60vh] animate-in overflow-y-auto border-nham-border border-t bg-nham-card px-4 py-4 duration-200"
    >
      <ul className="space-y-6">
        {sections.map((monthSection) => (
          <li key={monthSection.key}>
            <MonthSectionView
              section={monthSection}
              dates={dates}
              today={today}
              selectedDate={selectedDate}
              locale={locale}
              onSelectDate={handleDateSelect}
            />
          </li>
        ))}
      </ul>
    </nav>
  );
}

interface MonthSectionViewProps {
  section: MonthSection;
  dates: string[];
  today: string;
  selectedDate: string;
  locale: string;
  onSelectDate: (date: string) => void;
}

function MonthSectionView({
  section,
  dates,
  today,
  selectedDate,
  locale,
  onSelectDate,
}: MonthSectionViewProps) {
  const monthLabel = new Intl.DateTimeFormat(locale, {
    month: 'long',
    year: 'numeric',
  }).format(new Date(section.year, section.month - 1));

  return (
    <div className="space-y-3">
      <h3 className="font-sans-display font-semibold text-nham-text text-sm tracking-tight">
        {monthLabel}
      </h3>
      <ul className="space-y-4">
        {section.weeks.map((week) => (
          <li key={week.key}>
            <WeekSectionView
              week={week}
              dates={dates}
              today={today}
              selectedDate={selectedDate}
              locale={locale}
              onSelectDate={onSelectDate}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}

interface WeekSectionViewProps {
  week: { key: string; weekNumber: number; days: string[] };
  dates: string[];
  today: string;
  selectedDate: string;
  locale: string;
  onSelectDate: (date: string) => void;
}

function WeekSectionView({
  week,
  dates,
  today,
  selectedDate,
  locale,
  onSelectDate,
}: WeekSectionViewProps) {
  const t = useTranslations('logging.timelineSidebar');

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 font-medium text-nham-text-muted text-xs">
        <ChevronRight className="size-3.5" aria-hidden="true" />
        <span>{t('week', { number: week.weekNumber })}</span>
      </div>
      <ul className="flex flex-wrap gap-2">
        {week.days.map((date) => (
          <li key={date}>
            <TimelineDateButton
              date={date}
              label={formatDayLabel(date, locale)}
              isActive={date === selectedDate}
              isToday={date === today}
              hasMeal={dates.includes(date)}
              variant="mobile"
              onSelectDate={onSelectDate}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}
