'use client';

import { TimelineDateButton } from './timeline-date-button';

interface TimelineDayRowProps {
  date: string;
  label: string;
  isFirst: boolean;
  isLast: boolean;
  isActive: boolean;
  isToday: boolean;
  todayLabel: string;
  hasMeal: boolean;
  kcal: number | null;
  onSelectDate: (date: string) => void;
}

/**
 * One day in the week tree, wearing the rail that joins it to the week above.
 *
 * The rail is three absolutely-positioned pieces rather than one border: a
 * segment reaching up, a segment reaching down, and the L that curves into the
 * button. Splitting it that way is what lets the line stop exactly at the first
 * and last rows instead of overshooting the group.
 */
export function TimelineDayRow({
  date,
  label,
  isFirst,
  isLast,
  isActive,
  isToday,
  todayLabel,
  hasMeal,
  kcal,
  onSelectDate,
}: TimelineDayRowProps) {
  return (
    <li className="relative flex w-full min-w-0 items-center">
      {/* Upper vertical segment: for the first item it reaches up to the
          vertical midpoint of the Week row above (row height ~32px + mt-1
          gap = ~20px). */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute z-[2] w-0.5 bg-kallo-accent"
        style={{
          left: '-15px',
          top: isFirst ? '-0.25rem' : '-3px',
          height: isFirst ? 'calc(50% - 10px + 0.25rem)' : 'calc(50% - 7px)',
        }}
      />

      {/* Lower vertical segment: connects this item to the next (omitted on
          the last item so the line ends exactly at the final L-connector) */}
      {!isLast && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute z-[2] w-0.5 bg-kallo-accent"
          style={{
            left: '-15px',
            top: '50%',
            height: 'calc(50% + 3px)',
          }}
        />
      )}

      {/* L-shaped connector curving from the vertical line into the day button */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute z-[2] -translate-y-full rounded-bl-lg border-kallo-accent border-b-2 border-l-2"
        style={{
          left: '-15px',
          top: '50%',
          height: '10px',
          width: '15px',
        }}
      />

      <TimelineDateButton
        date={date}
        label={label}
        isActive={isActive}
        isToday={isToday}
        todayLabel={todayLabel}
        hasMeal={hasMeal}
        kcal={kcal}
        variant="desktop"
        onSelectDate={onSelectDate}
      />
    </li>
  );
}
