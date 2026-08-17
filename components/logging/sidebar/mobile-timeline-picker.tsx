'use client';

import {
  AlertCircle,
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useLocale, useTranslations } from 'next-intl';
import {
  type PointerEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/core/ui/cn';
import {
  addDays,
  buildCenteredStripFromAnchor,
  dateStringToDate,
  formatTimelineDayLabel,
} from './timeline-utils';

const SWIPE_THRESHOLD_PX = 40;
const SWIPE_COOLDOWN_MS = 250;
const WEEK_SLIDER_ID = 'mobile-week-slider';
const MOBILE_HEADER_SLOT_ID = 'app-mobile-header-slot';

// useSyncExternalStore inputs for resolving the portal slot. The slot is created
// once by MobileNav, so we don't need a real subscription — but we do need stable
// references to avoid an infinite loop in dev.
const subscribeNoop = () => () => {};
const getMobileHeaderSlot = (): HTMLElement | null =>
  document.getElementById(MOBILE_HEADER_SLOT_ID);
const getNoSlot = (): HTMLElement | null => null;

export interface MobileTimelinePickerProps {
  dates: string[];
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
        'flex min-h-11 min-w-0 flex-1 touch-manipulation flex-col items-center justify-center gap-0.5 overflow-hidden rounded-[0.9rem] px-0.5 py-1 transition-[background-color,color,transform] duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kallo-accent focus-visible:ring-offset-1 active:scale-[0.97] motion-reduce:transition-none',
        isSelected
          ? 'bg-kallo-hover font-semibold text-kallo-text'
          : 'text-kallo-text-muted hover:bg-kallo-hover/40',
        isToday && !isSelected && 'bg-kallo-hover text-kallo-text'
      )}
      aria-label={accessibleDateLabel}
      aria-current={isSelected ? 'date' : undefined}
      tabIndex={isVisible ? undefined : -1}
    >
      <span className="font-semibold text-[10px] uppercase leading-none tracking-tight">
        {dayName}
      </span>
      <span className="font-semibold text-[13px] leading-none">{dayNum}</span>
      {isFuture ? (
        <span className="h-1.5 w-1.5" aria-hidden="true" />
      ) : hasMeal ? (
        <span
          aria-hidden="true"
          className={cn(
            'h-1.5 w-1.5 rounded-full',
            isSelected ? 'bg-kallo-surface/70' : 'bg-kallo-accent'
          )}
        />
      ) : (
        <span
          aria-hidden="true"
          className="h-1.5 w-1.5 rounded-full border border-kallo-border/40"
        />
      )}
    </button>
  );
}

export function MobileTimelinePicker({
  dates,
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
  const wrapperRef = useRef<HTMLDivElement>(null);
  const pointerStartXRef = useRef<number | null>(null);
  const didSwipeRef = useRef(false);
  const lastSwipeAtRef = useRef(0);
  // The picker renders into a slot inside MobileNav so the date chip and the
  // hamburger share a single mobile row. We resolve the slot lazily via
  // useSyncExternalStore so SSR returns null (no DOM) and the client picks up
  // the slot on the first commit without needing setState in an effect.
  const portalTarget = useSyncExternalStore(
    subscribeNoop,
    getMobileHeaderSlot,
    getNoSlot
  );

  // Click anywhere outside the picker, or press Escape, collapses back to the
  // chip without forcing a date selection.
  useEffect(() => {
    if (mode !== 'strip') return;

    const handlePointerDown = (event: globalThis.PointerEvent) => {
      const wrapper = wrapperRef.current;
      if (!wrapper) return;
      if (!wrapper.contains(event.target as Node)) {
        setMode('chip');
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMode('chip');
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [mode]);

  // When the strip mounts, move focus to the selected day cell so keyboard
  // users can immediately arrow-tab through dates instead of starting at body.
  useEffect(() => {
    if (mode !== 'strip') return;
    const wrapper = wrapperRef.current;
    if (!wrapper) return;
    const selectedCell = wrapper.querySelector<HTMLButtonElement>(
      '[aria-current="date"]'
    );
    selectedCell?.focus({ preventScroll: true });
  }, [mode]);

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

  // Anchor = visual center of the 7-day strip. The most-recent allowed anchor
  // is `today` so we never page into a window that's entirely in the future.
  const currentAnchor = today;
  const selectedAnchor = useMemo(
    () => (selectedDate > currentAnchor ? currentAnchor : selectedDate),
    [currentAnchor, selectedDate]
  );
  const [visibleAnchor, setVisibleAnchor] = useState(selectedAnchor);

  const weekStrips = useMemo(
    () =>
      [
        addDays(visibleAnchor, -7),
        visibleAnchor,
        addDays(visibleAnchor, 7),
      ].map((anchor) => buildCenteredStripFromAnchor(anchor)),
    [visibleAnchor]
  );

  const canNavigateNext = visibleAnchor < currentAnchor;
  const visibleStripStart = useMemo(
    () => addDays(visibleAnchor, -3),
    [visibleAnchor]
  );

  const handleOpenStrip = useCallback(() => {
    setVisibleAnchor(selectedAnchor);
    setMode('strip');
  }, [selectedAnchor]);

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

  const navigateToAnchor = useCallback(
    (anchor: string) => {
      const nextAnchor = anchor > currentAnchor ? currentAnchor : anchor;
      setVisibleAnchor((current) =>
        nextAnchor === current ? current : nextAnchor
      );
    },
    [currentAnchor]
  );

  const scrollPrev = useCallback(() => {
    navigateToAnchor(addDays(visibleAnchor, -7));
  }, [navigateToAnchor, visibleAnchor]);

  const scrollNext = useCallback(() => {
    if (!canNavigateNext) return;
    navigateToAnchor(addDays(visibleAnchor, 7));
  }, [canNavigateNext, navigateToAnchor, visibleAnchor]);

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

  // When the host page provides the header slot (LoggingShell inside AppShell),
  // render into it via a portal so the chip sits in the mobile header row. The
  // inline fallback is the test/Storybook contract — production always finds the
  // slot because MobileNav mounts as a sibling. Do not delete the fallback when
  // refactoring; the tests rely on it to render without an AppShell parent.
  const renderIntoSlot = (node: React.ReactNode) =>
    portalTarget ? createPortal(node, portalTarget) : node;

  if (isPending) {
    return renderIntoSlot(
      <div className="flex w-full justify-center md:hidden">
        <Skeleton
          className="h-9 w-44 rounded-full"
          data-testid="mobile-picker-skeleton"
        />
      </div>
    );
  }

  return (
    <>
      {renderIntoSlot(
        <div
          ref={wrapperRef}
          // Kept for the strip-mode contract; the header slot is now full-width
          // (the hamburger was retired for the bottom tab bar), so the strip
          // already owns the whole row.
          data-strip-mode={mode === 'strip'}
          className="flex min-w-0 flex-1 items-center justify-center gap-2 md:hidden"
        >
          <motion.div
            layout
            transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
            className={cn(
              'flex min-w-0 max-w-full items-center overflow-hidden',
              mode === 'chip'
                ? 'h-11 max-w-[min(18rem,calc(100vw-2rem))] gap-2 rounded-full border border-kallo-border/50 bg-kallo-surface px-4'
                : 'h-11 w-full gap-1'
            )}
          >
            <AnimatePresence mode="popLayout" initial={false}>
              {mode === 'chip' ? (
                <motion.button
                  key="chip-content"
                  type="button"
                  onClick={handleOpenStrip}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.15, ease: 'easeOut' }}
                  className="inline-flex h-full w-full touch-manipulation items-center gap-2 font-medium text-[12px] text-kallo-text outline-none focus-visible:rounded-full focus-visible:ring-[3px] focus-visible:ring-kallo-accent/30"
                  aria-label={t('selectDate')}
                  aria-controls={WEEK_SLIDER_ID}
                  aria-expanded={false}
                >
                  <CalendarIcon
                    className="size-3.5 shrink-0 text-kallo-text-muted"
                    aria-hidden="true"
                  />
                  <span className="min-w-0 truncate">{formattedDate}</span>
                  {hasMeal && (
                    <span
                      className="inline-block size-1.5 shrink-0 rounded-full bg-kallo-accent"
                      role="status"
                      aria-label={t('hasMealIndicator')}
                    />
                  )}
                </motion.button>
              ) : (
                <motion.div
                  key="strip-content"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{
                    duration: 0.18,
                    delay: 0.05,
                    ease: 'easeOut',
                  }}
                  className="flex h-full w-full min-w-0 items-center gap-1"
                >
                  <button
                    type="button"
                    onClick={scrollPrev}
                    className={cn(
                      'flex h-10 w-9 shrink-0 touch-manipulation items-center justify-center rounded-full transition-[background-color,color,transform] duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kallo-accent focus-visible:ring-offset-1 active:scale-[0.96] motion-reduce:transition-none',
                      'text-kallo-text-muted hover:bg-kallo-hover/40 hover:text-kallo-text'
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
                        const isVisibleWeek =
                          week.days[0] === visibleStripStart;

                        return (
                          <div
                            key={week.days[0]}
                            className="flex min-w-0 flex-[0_0_100%] gap-1"
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
                      'flex h-10 w-9 shrink-0 touch-manipulation items-center justify-center rounded-full transition-[background-color,color,transform] duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kallo-accent focus-visible:ring-offset-1 active:scale-[0.96] disabled:active:scale-100 motion-reduce:transition-none',
                      canNavigateNext
                        ? 'text-kallo-text-muted hover:bg-kallo-hover/40 hover:text-kallo-text'
                        : 'text-kallo-text-muted/30'
                    )}
                    aria-label={t('nextWeek')}
                  >
                    <ChevronRight className="size-4" aria-hidden="true" />
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </div>
      )}

      {isError && (
        <div className="flex justify-center px-3 md:hidden">
          <div
            className="flex max-w-[min(22rem,calc(100vw-2rem))] items-center gap-2 rounded-full border border-kallo-danger/30 bg-kallo-danger/10 px-3 py-1.5"
            data-testid="mobile-picker-error"
            role="alert"
          >
            <div className="flex flex-1 items-center gap-1.5 text-kallo-danger text-xs">
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
        </div>
      )}
    </>
  );
}
