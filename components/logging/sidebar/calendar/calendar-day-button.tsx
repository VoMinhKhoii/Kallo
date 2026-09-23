'use client';

import { useEffect, useRef } from 'react';
import type { DayButton } from 'react-day-picker';
import { cn } from '@/lib/core/ui/cn';
import { dateToDateString } from '../timeline-utils';
import { CalorieRing } from './calorie-ring';
import { useMeasuredDay } from './day-progress-context';

/**
 * One day of the logging calendar: a 46px hit target holding the date inside
 * its calorie ring.
 *
 * Replaces the shadcn `CalendarDayButton` for this calendar only, rather than
 * restyling it from outside: that one paints selection as a filled `primary`
 * tile and today as an accent wash on the CELL, and the two overlapping were
 * the squared-off corners around a selected today. Selection here is the
 * brand's beige wash + semibold ink; today is semibold alone.
 */
export function CalendarDayButton({
  day,
  modifiers,
  className,
  children,
  ...props
}: React.ComponentProps<typeof DayButton>) {
  const ref = useRef<HTMLButtonElement>(null);
  const date = dateToDateString(day.date);
  const measured = useMeasuredDay(date);
  // A zero-kcal day has nothing to sweep: it reads as a bare track, not "below".
  const arc = measured && measured.fraction > 0 ? measured : null;

  // DayPicker moves focus by flagging the day, not by focusing it — the shadcn
  // button does the same, and without it arrow keys would move nothing.
  useEffect(() => {
    if (modifiers.focused) ref.current?.focus();
  }, [modifiers.focused]);

  return (
    <button
      ref={ref}
      type="button"
      data-progress={arc ? (arc.met ? 'met' : 'below') : undefined}
      className={cn(
        'relative flex size-[46px] items-center justify-center rounded-xl font-sans-display text-kallo-text text-sm tabular-nums transition-colors',
        'hover:bg-kallo-hover/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kallo-accent',
        'disabled:cursor-default disabled:text-kallo-stone/50 disabled:hover:bg-transparent aria-disabled:text-kallo-stone/50',
        modifiers.today && 'font-semibold',
        modifiers.selected &&
          'bg-kallo-hover font-semibold hover:bg-kallo-hover',
        className
      )}
      {...props}
    >
      {/* Future days are disabled, and go bare like the Flutter strip's: a
          track would suggest there is something there to fill. */}
      {modifiers.disabled ? null : (
        <CalorieRing
          fraction={arc?.fraction ?? 0}
          met={arc?.met ?? false}
          size={34}
          strokeWidth={2.25}
          className="absolute inset-0 m-auto"
        />
      )}
      <span className="relative">{children}</span>
    </button>
  );
}
