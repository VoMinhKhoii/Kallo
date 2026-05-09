'use client';

import {
  AlertCircle,
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import {
  type PointerEvent,
  useCallback,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import {
  addWeeks,
  buildWeekStripFromStart,
  clampWeekStartToCurrent,
  dateStringToDate,
  formatTimelineDayLabel,
  getWeekStart,
} from './timeline-utils';

const SWIPE_THRESHOLD_PX = 40;
const SWIPE_COOLDOWN_MS = 250;
const WEEK_SLIDER_ID = 'mobile-week-slider';

export interface MobileTimelinePickerProps {
  dates: string[];
  allDates: string[];
  today: string;
  selectedDate: string;
  isPending: boolean;
  isError: boolean;
  isRetrying?: boolean;
  onRetry: () => void;
  onSelectDate: (date: string) => void;
}

function DayCell({
  date,
  today,
  selectedDate,
  hasMeal,
  isVisible,
  locale,
  labels,
  onSelect,
}: {
  date: string;
  today: string;
  selectedDate: string;
  hasMeal: boolean;
  isVisible: boolean;
  locale: string;
  labels: {
    hasMeal: string;
    selectedDate: string;
    today: string;
  };
  onSelect: (date: string) => void;
}) {
  const dateObj = useMemo(() => dateStringToDate(date), [date]);
  const isToday = date === today;
  const isSelected = date === selectedDate;
  const isFuture = date > today;

  const dayName = useMemo(
    () => new Intl.DateTimeFormat(locale, { weekday: 'short' }).format(dateObj),
    [locale, dateObj]
  );
  const accessibleDateLabel = useMemo(() => {
    const parts = [
      new Intl.DateTimeFormat(locale, {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      }).format(dateObj),
    ];

    if (isToday) parts.push(labels.today);
    if (isSelected) parts.push(labels.selectedDate);
    if (hasMeal) parts.push(labels.hasMeal);

    return parts.join(', ');
  }, [dateObj, hasMeal, isSelected, isToday, labels, locale]);
  const dayNum = dateObj.getDate();

  return (
    <button
      type="button"
      onClick={() => onSelect(date)}
      className={cn(
        'flex min-h-12 min-w-0 flex-1 touch-manipulation flex-col items-center justify-center gap-0.5 overflow-hidden rounded-[0.9rem] px-0.5 py-1 transition-[background-color,color,box-shadow,transform] duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nham-accent focus-visible:ring-offset-1 active:scale-[0.97] motion-reduce:transition-none',
        isSelected
          ? 'bg-nham-text text-nham-surface shadow-sm'
          : 'text-nham-text-muted hover:bg-nham-hover/60',
        isToday && !isSelected && 'bg-nham-accent/15 text-nham-text'
      )}
      aria-label={accessibleDateLabel}
      aria-current={isSelected ? 'date' : undefined}
      tabIndex={isVisible ? undefined : -1}
    >
      <span className="font-semibold text-[10px] uppercase leading-none tracking-tight">
        {dayName}
      </span>
      <span
        className={cn(
          'font-semibold text-[13px] leading-none',
          isToday && !isSelected && 'text-nham-accent'
        )}
      >
        {dayNum}
      </span>
      {isFuture ? (
        <span className="h-1.5 w-1.5" aria-hidden="true" />
      ) : hasMeal ? (
        <span
          aria-hidden="true"
          className={cn(
            'h-1.5 w-1.5 rounded-full',
            isSelected ? 'bg-nham-surface/70' : 'bg-nham-accent'
          )}
        />
      ) : (
        <span
          aria-hidden="true"
          className="h-1.5 w-1.5 rounded-full border border-nham-border/40"
        />
      )}
    </button>
  );
}

export function MobileTimelinePicker({
  dates,
  allDates: _allDates,
  today,
  selectedDate,
  isPending,
  isError,
  isRetrying = false,
  onRetry,
  onSelectDate,
}: MobileTimelinePickerProps) {
  const t = useTranslations('logging.timelineSidebar');
  const locale = useLocale();
  const [mode, setMode] = useState<'chip' | 'strip'>('chip');
  const pointerStartXRef = useRef<number | null>(null);
  const didSwipeRef = useRef(false);
  const lastSwipeAtRef = useRef(0);

  const mealDates = useMemo(() => new Set(dates), [dates]);
  const hasMeal = mealDates.has(selectedDate);
  const formattedDate = formatTimelineDayLabel(selectedDate, locale);
  const dayCellLabels = useMemo(
    () => ({
      hasMeal: t('hasMealIndicator'),
      selectedDate: t('selectedDateLabel'),
      today: t('todayLabel'),
    }),
    [t]
  );

  const currentWeekStart = useMemo(() => getWeekStart(today), [today]);
  const selectedWeekStart = useMemo(
    () => clampWeekStartToCurrent(getWeekStart(selectedDate), currentWeekStart),
    [currentWeekStart, selectedDate]
  );
  const [visibleWeekStart, setVisibleWeekStart] = useState(selectedWeekStart);

  const weekStrips = useMemo(
    () =>
      [
        addWeeks(visibleWeekStart, -1),
        visibleWeekStart,
        addWeeks(visibleWeekStart, 1),
      ].map((weekStart) => buildWeekStripFromStart(weekStart)),
    [visibleWeekStart]
  );

  const canNavigateNext = visibleWeekStart < currentWeekStart;

  const handleOpenStrip = useCallback(() => {
    setVisibleWeekStart(selectedWeekStart);
    setMode('strip');
  }, [selectedWeekStart]);

  const handleSelectDay = useCallback(
    (date: string) => {
      if (didSwipeRef.current) {
        didSwipeRef.current = false;
        return;
      }

      if (date !== selectedDate) {
        onSelectDate(date);
      }
      setMode('chip');
    },
    [onSelectDate, selectedDate]
  );

  const navigateToWeek = useCallback(
    (weekStart: string) => {
      const nextWeekStart = clampWeekStartToCurrent(
        weekStart,
        currentWeekStart
      );
      setVisibleWeekStart((currentWeek) =>
        nextWeekStart === currentWeek ? currentWeek : nextWeekStart
      );
    },
    [currentWeekStart]
  );

  const scrollPrev = useCallback(() => {
    navigateToWeek(addWeeks(visibleWeekStart, -1));
  }, [navigateToWeek, visibleWeekStart]);

  const scrollNext = useCallback(() => {
    if (!canNavigateNext) return;
    navigateToWeek(addWeeks(visibleWeekStart, 1));
  }, [canNavigateNext, navigateToWeek, visibleWeekStart]);

  const handlePointerDown = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      pointerStartXRef.current = event.clientX;
      didSwipeRef.current = false;
    },
    []
  );

  const handlePointerUp = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      const startX = pointerStartXRef.current;
      pointerStartXRef.current = null;
      if (startX === null) return;

      const deltaX = event.clientX - startX;
      if (Math.abs(deltaX) < SWIPE_THRESHOLD_PX) return;

      const now = Date.now();
      if (now - lastSwipeAtRef.current < SWIPE_COOLDOWN_MS) return;

      lastSwipeAtRef.current = now;
      didSwipeRef.current = true;
      event.currentTarget.focus({ preventScroll: true });
      if (deltaX > 0) {
        scrollPrev();
      } else {
        scrollNext();
      }
    },
    [scrollNext, scrollPrev]
  );

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
    <div className="flex w-full min-w-0 max-w-full flex-col items-center gap-2 overflow-hidden md:hidden">
      {mode === 'chip' ? (
        <button
          type="button"
          onClick={handleOpenStrip}
          className={cn(
            'inline-flex h-11 max-w-[min(18rem,calc(100vw-2rem))] touch-manipulation items-center gap-2 rounded-full border border-nham-border/70 bg-nham-surface px-4 font-semibold text-[12px] text-nham-text shadow-sm outline-none transition-[background-color,border-color] hover:border-nham-accent/40 hover:bg-nham-hover/50 focus-visible:border-nham-accent focus-visible:ring-[3px] focus-visible:ring-nham-accent/20'
          )}
          aria-label={t('selectDate')}
          aria-controls={WEEK_SLIDER_ID}
          aria-expanded={false}
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
      ) : (
        <div className="flex w-full min-w-0 max-w-full items-center gap-1 overflow-hidden rounded-[1.15rem] border border-nham-border/70 bg-nham-surface/95 p-1 shadow-[0_10px_28px_-22px_rgba(44,36,22,0.55)]">
          <button
            type="button"
            onClick={scrollPrev}
            className={cn(
              'flex h-12 w-11 shrink-0 touch-manipulation items-center justify-center rounded-full transition-[background-color,color,transform] duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nham-accent focus-visible:ring-offset-1 active:scale-[0.96] motion-reduce:transition-none',
              'text-nham-text hover:bg-nham-hover/50'
            )}
            aria-label={t('previousWeek')}
          >
            <ChevronLeft className="size-4" aria-hidden="true" />
          </button>

          <div
            className="min-w-0 flex-1 touch-pan-y overflow-hidden"
            id={WEEK_SLIDER_ID}
            data-testid="mobile-week-slider"
            role="group"
            aria-label={t('selectDate')}
            tabIndex={-1}
            onPointerDown={handlePointerDown}
            onPointerUp={handlePointerUp}
          >
            <div
              className="flex touch-manipulation transition-transform duration-200 ease-out motion-reduce:transition-none"
              style={{ transform: 'translateX(-100%)' }}
            >
              {weekStrips.map((week) => {
                const isVisibleWeek = week.days[0] === visibleWeekStart;

                return (
                  <div
                    key={week.days[0]}
                    className="flex min-w-0 flex-[0_0_100%] gap-1 px-0.5"
                    data-week-start={week.days[0]}
                    aria-hidden={!isVisibleWeek}
                  >
                    {week.days.map((date) => (
                      <DayCell
                        key={date}
                        date={date}
                        today={today}
                        selectedDate={selectedDate}
                        hasMeal={mealDates.has(date)}
                        isVisible={isVisibleWeek}
                        locale={locale}
                        labels={dayCellLabels}
                        onSelect={handleSelectDay}
                      />
                    ))}
                  </div>
                );
              })}
            </div>
          </div>

          <button
            type="button"
            onClick={scrollNext}
            disabled={!canNavigateNext}
            className={cn(
              'flex h-12 w-11 shrink-0 touch-manipulation items-center justify-center rounded-full transition-[background-color,color,transform] duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nham-accent focus-visible:ring-offset-1 active:scale-[0.96] disabled:active:scale-100 motion-reduce:transition-none',
              canNavigateNext
                ? 'text-nham-text hover:bg-nham-hover/50'
                : 'text-nham-text-muted/30'
            )}
            aria-label={t('nextWeek')}
          >
            <ChevronRight className="size-4" aria-hidden="true" />
          </button>
        </div>
      )}

      {isError && (
        <div
          className="flex max-w-[min(22rem,calc(100vw-2rem))] items-center gap-2 rounded-full border border-destructive/30 bg-destructive/5 px-3 py-1.5"
          data-testid="mobile-picker-error"
          role="alert"
        >
          <div className="flex flex-1 items-center gap-1.5 text-destructive text-xs">
            <AlertCircle className="size-3.5 shrink-0" aria-hidden="true" />
            <span>{t('failedToLoadDates')}</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onRetry}
            disabled={isRetrying}
            aria-busy={isRetrying}
            aria-label={t('retryDates')}
          >
            {t('retryDates')}
          </Button>
        </div>
      )}
    </div>
  );
}
