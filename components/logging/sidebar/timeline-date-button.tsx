'use client';

import { cn } from '@/lib/core/ui/cn';

interface TimelineDateButtonProps {
  date: string;
  label: string;
  isActive: boolean;
  isToday?: boolean;
  todayLabel?: string;
  hasMeal?: boolean;
  variant: 'desktop' | 'mobile';
  onSelectDate: (date: string) => void;
}

export function TimelineDateButton({
  date,
  label,
  isActive,
  isToday = false,
  todayLabel,
  hasMeal = false,
  variant,
  onSelectDate,
}: TimelineDateButtonProps) {
  // The desktop tree now lists every day of the week, logged or not, so the two
  // have to read apart. A logged day steps up to primary ink and medium weight
  // against the muted resting tone — the neutral pair doing the work, with no
  // dot or badge added to a list that is already dense. Mobile keeps its dot.
  const restingTone = (() => {
    if (variant === 'mobile') return 'font-medium text-kallo-text-muted';
    return hasMeal
      ? 'font-medium text-kallo-text'
      : 'font-normal text-kallo-text-muted';
  })();

  return (
    <button
      type="button"
      onClick={() => onSelectDate(date)}
      aria-current={isActive ? 'date' : undefined}
      data-today={isToday ? 'true' : 'false'}
      data-has-meal={hasMeal ? 'true' : 'false'}
      className={cn(
        'group/date relative touch-manipulation rounded-xl font-sans-display tracking-tight transition-[background-color,color,transform,box-shadow] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kallo-accent focus-visible:ring-offset-2 focus-visible:ring-offset-kallo-surface active:scale-[0.98]',
        variant === 'mobile'
          ? 'flex min-h-11 min-w-[4.5rem] shrink-0 flex-col items-center justify-center gap-0.5 px-3 py-2 text-[11px]'
          : 'ml-2 flex min-h-9 min-w-0 flex-1 items-center px-2.5 py-1.5 text-sm',
        isActive
          ? 'bg-kallo-hover font-semibold text-kallo-text hover:bg-kallo-hover/70'
          : cn(restingTone, 'hover:bg-kallo-hover/50 hover:text-kallo-text')
      )}
    >
      <span className="min-w-0 truncate">
        {label}
        {isToday && variant === 'desktop' && (
          <span className="ml-1 font-normal text-[11px] text-kallo-text-muted/70">
            {' '}
            ({todayLabel})
          </span>
        )}
      </span>
      {hasMeal && variant === 'mobile' && (
        <span
          aria-hidden="true"
          className={cn(
            'h-1.5 w-1.5 rounded-full',
            isActive ? 'bg-kallo-text/50' : 'bg-kallo-accent'
          )}
        />
      )}
    </button>
  );
}
